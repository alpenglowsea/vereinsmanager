import React, { useState, useEffect } from 'react';
import {
  DonationReceipt,
  DonationType,
  Member,
  FinancialAccount,
  ClubSettings
} from '../types';
import { numberToGermanWords, downloadDonationReceiptPdf } from '../services/donationService';
import {
  X,
  HeartHandshake,
  Coins,
  Package,
  Building2,
  User,
  Calendar,
  FileText,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
  Download,
  Wallet
} from 'lucide-react';

interface DonationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    receipt: DonationReceipt,
    options: {
      autoArchiveDoc: boolean;
      autoCreateTx: boolean;
      targetAccountId?: string;
    }
  ) => Promise<void>;
  editingReceipt: DonationReceipt | null;
  members: Member[];
  accounts: FinancialAccount[];
  settings: ClubSettings;
  nextReceiptNumber: string;
}

export const DonationFormModal: React.FC<DonationFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingReceipt,
  members,
  accounts,
  settings,
  nextReceiptNumber
}) => {
  const [type, setType] = useState<DonationType>('money');
  const [receiptNumber, setReceiptNumber] = useState(nextReceiptNumber);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [donorSource, setDonorSource] = useState<'member' | 'external'>('member');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [donorName, setDonorName] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Deutschland');
  const [amount, setAmount] = useState<string>('100.00');
  const [amountInWords, setAmountInWords] = useState('');
  const [isWaiverOfRefund, setIsWaiverOfRefund] = useState(false);

  // Goods
  const [goodsDescription, setGoodsDescription] = useState('');
  const [goodsOrigin, setGoodsOrigin] = useState<'private' | 'business'>('private');
  const [goodsValuationBasis, setGoodsValuationBasis] = useState('Kaufbeleg / Rechnung liegt vor');

  // Tax Exemption Details
  const [showTaxDetails, setShowTaxDetails] = useState(false);
  const [taxOffice, setTaxOffice] = useState(settings.taxOffice || 'Finanzamt Musterstadt');
  const [taxNumber, setTaxNumber] = useState(settings.taxNumber || '112/5840/1922');
  const [exemptionDate, setExemptionDate] = useState(settings.taxExemptionDate || '10.01.2024');
  const [assessmentPeriod, setAssessmentPeriod] = useState(settings.taxAssessmentPeriod || '2021 bis 2023');
  const [promotedPurpose, setPromotedPurpose] = useState(settings.promotedPurposes || 'Förderung des Sports (§ 52 Abs. 2 Satz 1 Nr. 21 AO)');
  const [issuedBy, setIssuedBy] = useState(`${settings.treasurer || 'Schatzmeister'} (Vorstand)`);
  const [cityAndDate, setCityAndDate] = useState(`Musterstadt, ${new Date().toLocaleDateString('de-DE')}`);
  const [notes, setNotes] = useState('');

  // Automated Integration Options
  const [autoArchiveDoc, setAutoArchiveDoc] = useState(true);
  const [autoCreateTx, setAutoCreateTx] = useState(true);
  const [targetAccountId, setTargetAccountId] = useState(accounts[0]?.id || 'acc-1');

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingReceipt) {
      setType(editingReceipt.type);
      setReceiptNumber(editingReceipt.receiptNumber);
      setDate(editingReceipt.date);
      setDonorSource(editingReceipt.donorType);
      setSelectedMemberId(editingReceipt.memberId || '');
      setDonorName(editingReceipt.donorName);
      setStreet(editingReceipt.donorAddress.street);
      setHouseNumber(editingReceipt.donorAddress.houseNumber);
      setZip(editingReceipt.donorAddress.zip);
      setCity(editingReceipt.donorAddress.city);
      setCountry(editingReceipt.donorAddress.country || 'Deutschland');
      setAmount(editingReceipt.amount.toString());
      setAmountInWords(editingReceipt.amountInWords);
      setIsWaiverOfRefund(editingReceipt.isWaiverOfRefund);
      setGoodsDescription(editingReceipt.goodsDescription || '');
      setGoodsOrigin(editingReceipt.goodsOrigin || 'private');
      setGoodsValuationBasis(editingReceipt.goodsValuationBasis || '');
      setTaxOffice(editingReceipt.taxOffice || settings.taxOffice || 'Finanzamt Musterstadt');
      setTaxNumber(editingReceipt.taxNumber || settings.taxNumber || '');
      setExemptionDate(editingReceipt.exemptionDate || settings.taxExemptionDate || '');
      setAssessmentPeriod(editingReceipt.assessmentPeriod || settings.taxAssessmentPeriod || '');
      setPromotedPurpose(editingReceipt.promotedPurpose || settings.promotedPurposes || '');
      setIssuedBy(editingReceipt.issuedBy || '');
      setCityAndDate(editingReceipt.cityAndDate || '');
      setNotes(editingReceipt.notes || '');
      setAutoCreateTx(false); // don't duplicate on edit
    } else {
      // Reset for new receipt
      setType('money');
      setReceiptNumber(nextReceiptNumber);
      setDate(new Date().toISOString().split('T')[0]);
      setDonorSource('member');
      if (members.length > 0) {
        const m = members[0];
        setSelectedMemberId(m.id);
        setDonorName(`${m.firstName} ${m.lastName}`);
        setStreet(m.address.street);
        setHouseNumber(m.address.houseNumber);
        setZip(m.address.zip);
        setCity(m.address.city);
        setCountry(m.address.country || 'Deutschland');
      } else {
        setSelectedMemberId('');
        setDonorName('');
        setStreet('');
        setHouseNumber('');
        setZip('');
        setCity('');
        setCountry('Deutschland');
      }
      setAmount('100.00');
      setAmountInWords(numberToGermanWords(100));
      setIsWaiverOfRefund(false);
      setGoodsDescription('');
      setGoodsOrigin('private');
      setGoodsValuationBasis('Kaufbeleg / Rechnung liegt vor');
      setTaxOffice(settings.taxOffice || 'Finanzamt Musterstadt');
      setTaxNumber(settings.taxNumber || '112/5840/1922');
      setExemptionDate(settings.taxExemptionDate || '10.01.2024');
      setAssessmentPeriod(settings.taxAssessmentPeriod || '2021 bis 2023');
      setPromotedPurpose(settings.promotedPurposes || 'Förderung des Sports (§ 52 Abs. 2 Satz 1 Nr. 21 AO)');
      setIssuedBy(`${settings.treasurer || 'Schatzmeister'} (Vorstand)`);
      setCityAndDate(`Musterstadt, ${new Date().toLocaleDateString('de-DE')}`);
      setNotes('');
      setAutoArchiveDoc(true);
      setAutoCreateTx(true);
      setTargetAccountId(accounts[0]?.id || 'acc-1');
    }
  }, [editingReceipt, isOpen, nextReceiptNumber, settings]);

  // Handle member select
  const handleMemberChange = (memberId: string) => {
    setSelectedMemberId(memberId);
    const m = members.find(mem => mem.id === memberId);
    if (m) {
      setDonorName(`${m.firstName} ${m.lastName}`);
      setStreet(m.address.street);
      setHouseNumber(m.address.houseNumber);
      setZip(m.address.zip);
      setCity(m.address.city);
      setCountry(m.address.country || 'Deutschland');
    }
  };

  // Update words on amount change
  const handleAmountChange = (val: string) => {
    setAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setAmountInWords(numberToGermanWords(num));
    } else {
      setAmountInWords('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Bitte geben Sie einen gültigen Betrag größer 0 € ein.');
      return;
    }
    if (!donorName.trim()) {
      alert('Bitte geben Sie den Namen des Spenders ein.');
      return;
    }
    if (type === 'goods' && !goodsDescription.trim()) {
      alert('Bitte geben Sie die genaue Bezeichnung der Sachspende ein.');
      return;
    }

    const receipt: DonationReceipt = {
      id: editingReceipt?.id || `don-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      receiptNumber: receiptNumber.trim() || nextReceiptNumber,
      type,
      date,
      donorType: donorSource,
      memberId: donorSource === 'member' ? selectedMemberId : undefined,
      donorName: donorName.trim(),
      donorAddress: {
        street: street.trim(),
        houseNumber: houseNumber.trim(),
        zip: zip.trim(),
        city: city.trim(),
        country: country.trim() || 'Deutschland'
      },
      amount: numAmount,
      amountInWords: amountInWords.trim() || numberToGermanWords(numAmount),
      isWaiverOfRefund,
      goodsDescription: type === 'goods' ? goodsDescription.trim() : undefined,
      goodsOrigin: type === 'goods' ? goodsOrigin : undefined,
      goodsValuationBasis: type === 'goods' ? goodsValuationBasis.trim() : undefined,
      taxOffice: taxOffice.trim(),
      taxNumber: taxNumber.trim(),
      exemptionDate: exemptionDate.trim(),
      assessmentPeriod: assessmentPeriod.trim(),
      promotedPurpose: promotedPurpose.trim(),
      isDirectlyPromoted: true,
      issuedBy: issuedBy.trim(),
      cityAndDate: cityAndDate.trim(),
      notes: notes.trim(),
      createdAt: editingReceipt?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setIsSaving(true);
    try {
      await onSave(receipt, {
        autoArchiveDoc,
        autoCreateTx: type === 'money' ? autoCreateTx : false,
        targetAccountId
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Fehler beim Speichern der Zuwendungsbestätigung.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPreview = () => {
    const numAmount = parseFloat(amount) || 0;
    const tempReceipt: DonationReceipt = {
      id: 'preview',
      receiptNumber: receiptNumber || nextReceiptNumber,
      type,
      date,
      donorType: donorSource,
      memberId: selectedMemberId,
      donorName: donorName || 'Spender Name',
      donorAddress: {
        street: street || 'Musterstraße',
        houseNumber: houseNumber || '1',
        zip: zip || '12345',
        city: city || 'Musterstadt',
        country: country || 'Deutschland'
      },
      amount: numAmount,
      amountInWords: amountInWords || numberToGermanWords(numAmount),
      isWaiverOfRefund,
      goodsDescription: type === 'goods' ? goodsDescription : undefined,
      goodsOrigin: type === 'goods' ? goodsOrigin : undefined,
      goodsValuationBasis: type === 'goods' ? goodsValuationBasis : undefined,
      taxOffice,
      taxNumber,
      exemptionDate,
      assessmentPeriod,
      promotedPurpose,
      isDirectlyPromoted: true,
      issuedBy,
      cityAndDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    downloadDonationReceiptPdf(tempReceipt, settings);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {editingReceipt ? 'Zuwendungsbestätigung bearbeiten' : 'Neue Zuwendungsbestätigung erstellen'}
              </h3>
              <p className="text-xs text-slate-500">
                Amtliches BMF-Muster gem. § 50 Abs. 1 EStDV für gemeinnützige Vereine
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* 1. Typ-Auswahl (Geld vs. Sachzuwendung) */}
          <div>
            <label className="block font-bold text-slate-700 mb-2 uppercase text-[11px] tracking-wider">
              1. Art der Zuwendung
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('money')}
                className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all text-left ${
                  type === 'money'
                    ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 font-bold'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className={`p-2 rounded-lg ${type === 'money' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">Geldzuwendung (Muster 1)</div>
                  <div className="text-2xs text-slate-500">Überweisung, SEPA, Barzahlung, Aufwandsspende</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('goods')}
                className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all text-left ${
                  type === 'goods'
                    ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 text-blue-950 font-bold'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className={`p-2 rounded-lg ${type === 'goods' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">Sachzuwendung (Muster 2)</div>
                  <div className="text-2xs text-slate-500">Sportgeräte, Trikots, Inventar, Gebrauchtgüter</div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Belegnummer & Datum */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Bescheinigungs-Nummer *
              </label>
              <input
                type="text"
                required
                value={receiptNumber}
                onChange={e => setReceiptNumber(e.target.value)}
                placeholder="z.B. ZB-2025-001"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tag der Zuwendung *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* 3. Spender / Zuwendender */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-bold text-slate-700 uppercase text-[11px] tracking-wider">
                2. Name und Anschrift des Zuwendenden
              </label>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDonorSource('member')}
                  className={`px-2.5 py-1 rounded text-2xs font-semibold transition-all ${
                    donorSource === 'member'
                      ? 'bg-white shadow-2xs text-slate-900'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Vereinsmitglied
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDonorSource('external');
                    setSelectedMemberId('');
                  }}
                  className={`px-2.5 py-1 rounded text-2xs font-semibold transition-all ${
                    donorSource === 'external'
                      ? 'bg-white shadow-2xs text-slate-900'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Extern / Firma / Sponsor
                </button>
              </div>
            </div>

            {donorSource === 'member' && (
              <div className="mb-3">
                <label className="block font-medium text-slate-600 mb-1">
                  Mitglied auswählen:
                </label>
                <select
                  value={selectedMemberId}
                  onChange={e => handleMemberChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Mitglied auswählen --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.memberNumber} - {m.lastName}, {m.firstName} ({m.department})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  Vollständiger Name / Firmenname *
                </label>
                <input
                  type="text"
                  required
                  value={donorName}
                  onChange={e => setDonorName(e.target.value)}
                  placeholder="z.B. Sabine Mustermann oder Stadtwerke GmbH"
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-medium text-slate-600 mb-1">Straße</label>
                  <input
                    type="text"
                    value={street}
                    onChange={e => setStreet(e.target.value)}
                    placeholder="Hauptstraße"
                    className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-600 mb-1">Hausnr.</label>
                  <input
                    type="text"
                    value={houseNumber}
                    onChange={e => setHouseNumber(e.target.value)}
                    placeholder="12a"
                    className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-600 mb-1">PLZ</label>
                  <input
                    type="text"
                    value={zip}
                    onChange={e => setZip(e.target.value)}
                    placeholder="12345"
                    className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-medium text-slate-600 mb-1">Ort</label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="Musterstadt"
                    className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Betrag & Betrag in Worten */}
          <div>
            <label className="block font-bold text-slate-700 mb-2 uppercase text-[11px] tracking-wider">
              3. {type === 'goods' ? 'Ermittelter Sachwert' : 'Spendenbetrag'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-50/40 p-4 rounded-xl border border-emerald-200">
              <div>
                <label className="block font-semibold text-emerald-950 mb-1">
                  Betrag in Ziffern (€) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={e => handleAmountChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-sm font-mono font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2.5 font-bold text-emerald-600">€</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-emerald-950 mb-1">
                  Betrag in Worten (gem. BMF Vorgabe) *
                </label>
                <input
                  type="text"
                  required
                  value={amountInWords}
                  onChange={e => setAmountInWords(e.target.value)}
                  placeholder="z.B. Eintausendfünfhundert Euro"
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Geldspende spezifisch: Aufwandsspende Checkbox */}
            {type === 'money' && (
              <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="waiverCheckbox"
                  checked={isWaiverOfRefund}
                  onChange={e => setIsWaiverOfRefund(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="waiverCheckbox" className="text-xs text-slate-700 cursor-pointer">
                  <span className="font-semibold">Verzicht auf Erstattung von Aufwendungen (Aufwandsspende)</span>
                  <p className="text-2xs text-slate-500">
                    Aktivieren, wenn der Spender auf einen zuvor schriftlich vereinbarten Anspruch auf Aufwendungsersatz verzichtet hat (z.B. Fahrtkosten, Schiedsrichterentschädigung, Übungsleitervergütung).
                  </p>
                </label>
              </div>
            )}
          </div>

          {/* 5. Sachspende Spezifisch */}
          {type === 'goods' && (
            <div className="space-y-3 bg-blue-50/40 p-4 rounded-xl border border-blue-200">
              <div className="font-bold text-blue-950 text-xs">Angaben zur Sachspende (BMF Muster 2)</div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Genaue Bezeichnung der Sachzuwendung (Gegenstand, Alter, Zustand, etc.) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={goodsDescription}
                  onChange={e => setGoodsDescription(e.target.value)}
                  placeholder="z.B. 1x Tischtennisplatte JOOLA 2000-S Pro inkl. Zubehör, Zustand: Neuwertig, Kaufdatum 2024"
                  className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Herkunft der Sachspende
                  </label>
                  <select
                    value={goodsOrigin}
                    onChange={e => setGoodsOrigin(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs font-semibold"
                  >
                    <option value="private">Privatvermögen (Bewertung mit gemeinem Wert)</option>
                    <option value="business">Betriebsvermögen (Entnahmewert)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Unterlagen zur Wertermittlung
                  </label>
                  <input
                    type="text"
                    value={goodsValuationBasis}
                    onChange={e => setGoodsValuationBasis(e.target.value)}
                    placeholder="z.B. Originalrechnung vom 10.01.2025 liegt vor"
                    className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 6. Automatische Buchung & Archivierung */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">
              4. Automatische Verbuchung & Archivierung
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoDoc"
                checked={autoArchiveDoc}
                onChange={e => setAutoArchiveDoc(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="autoDoc" className="text-xs text-slate-700 cursor-pointer flex items-center gap-1.5 font-medium">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Automatisch als PDF in die Dokumentenablage & Belegarchivierung ablegen
              </label>
            </div>

            {type === 'money' && (
              <div className="space-y-2 pt-1 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoTx"
                    checked={autoCreateTx}
                    onChange={e => setAutoCreateTx(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="autoTx" className="text-xs text-slate-700 cursor-pointer flex items-center gap-1.5 font-medium">
                    <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                    Automatisch Einnahmebuchung im Kassenjournal (Ideeller Bereich: Spenden) anlegen
                  </label>
                </div>

                {autoCreateTx && (
                  <div className="pl-6 pt-1 flex items-center gap-2">
                    <span className="text-2xs text-slate-500">Zielkonto:</span>
                    <select
                      value={targetAccountId}
                      onChange={e => setTargetAccountId(e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700"
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 7. Collapsible: Freistellungsbescheid & Finanzamtsdaten */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTaxDetails(!showTaxDetails)}
              className="w-full px-4 py-2.5 bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span>Steuer- & Freistellungsangaben des Finanzamts</span>
              </div>
              {showTaxDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showTaxDetails && (
              <div className="p-4 bg-white space-y-3 border-t border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Zuständiges Finanzamt</label>
                    <input
                      type="text"
                      value={taxOffice}
                      onChange={e => setTaxOffice(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Steuernummer</label>
                    <input
                      type="text"
                      value={taxNumber}
                      onChange={e => setTaxNumber(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Datum Freistellungsbescheid</label>
                    <input
                      type="text"
                      value={exemptionDate}
                      onChange={e => setExemptionDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Veranlagungszeitraum</label>
                    <input
                      type="text"
                      value={assessmentPeriod}
                      onChange={e => setAssessmentPeriod(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">Geförderter gemeinnütziger Zweck</label>
                  <input
                    type="text"
                    value={promotedPurpose}
                    onChange={e => setPromotedPurpose(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Ausgestellt durch</label>
                    <input
                      type="text"
                      value={issuedBy}
                      onChange={e => setIssuedBy(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Ort & Ausstellungsdatum</label>
                    <input
                      type="text"
                      value={cityAndDate}
                      onChange={e => setCityAndDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notizen */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Interne Notizen / Verwendungszweck
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="z.B. Zweckgebunden für neue Jugend-Trikots oder Trainingsgeräte"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDownloadPreview}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors flex items-center gap-1.5 text-xs"
              title="Vorschau der Zuwendungsbestätigung als PDF herunterladen"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>PDF Vorschau</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors text-xs"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors shadow-xs flex items-center gap-1.5 text-xs disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'Wird gespeichert...' : 'Bestätigung erstellen & speichern'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
