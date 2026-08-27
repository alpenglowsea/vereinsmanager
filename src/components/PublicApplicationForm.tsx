import React, { useState, useMemo } from 'react';
import {
  User,
  MapPin,
  Calendar,
  CreditCard,
  FileCheck2,
  PenTool,
  CheckCircle2,
  AlertCircle,
  Download,
  Building2,
  ShieldCheck,
  Phone,
  Mail,
  Users,
  ChevronRight,
  ChevronLeft,
  Eye,
  Info,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Lock
} from 'lucide-react';
import {
  OnlineMembershipApplication,
  ClubSettings,
  Gender,
  MembershipType,
  PaymentMethod,
  FeePeriod,
  ApplicationTemplateSettings
} from '../types';
import { DigitalSignaturePad } from './DigitalSignaturePad';
import {
  generateMembershipApplicationPdf,
  calculateAge,
  getMembershipTypeLabel,
  getFeePeriodLabel
} from '../services/membershipPdfService';

interface PublicApplicationFormProps {
  settings: ClubSettings;
  templateSettings?: ApplicationTemplateSettings;
  onSubmitApplication: (app: OnlineMembershipApplication) => Promise<void>;
  onClose?: () => void;
  isStandalone?: boolean;
}

export const PublicApplicationForm: React.FC<PublicApplicationFormProps> = ({
  settings,
  templateSettings,
  onSubmitApplication,
  onClose,
  isStandalone = false
}) => {
  // Form step: 1 = Personal, 2 = Membership, 3 = Payment & SEPA, 4 = Legal & Signatures, 5 = Preview & Submit, 6 = Success
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedApp, setSubmittedApp] = useState<OnlineMembershipApplication | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<Gender>('m');
  const [birthDate, setBirthDate] = useState('');
  const [nationality, setNationality] = useState('Deutsch');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Address
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Deutschland');

  // Membership
  const [department, setDepartment] = useState(settings.departments[0] || 'Hauptverein');
  const [membershipType, setMembershipType] = useState<MembershipType>('full');
  const [feePeriod, setFeePeriod] = useState<FeePeriod>('monthly');
  const [monthlyDueDay, setMonthlyDueDay] = useState<1 | 15>(1);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [previousClub, setPreviousClub] = useState('');
  const [notes, setNotes] = useState('');

  // Legal Guardian (Minderjährig)
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('Mutter');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');

  // Payment & Bank
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sepa');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  // Consents
  const [dataPrivacyConsent, setDataPrivacyConsent] = useState(false);
  const [statuteConsent, setStatuteConsent] = useState(false);
  const [photoConsent, setPhotoConsent] = useState(true);
  const [healthConfirmation, setHealthConfirmation] = useState(true);

  // Signatures (PNG Base64)
  const [applicantSignature, setApplicantSignature] = useState<string | undefined>(undefined);
  const [guardianSignature, setGuardianSignature] = useState<string | undefined>(undefined);
  const [sepaSignature, setSepaSignature] = useState<string | undefined>(undefined);

  // Age calculation
  const age = useMemo(() => calculateAge(birthDate), [birthDate]);
  const isMinor = age !== null && age < 18;

  // Auto-fill account holder if empty
  const handleFirstNameBlur = () => {
    if (!accountHolder && firstName && lastName) {
      setAccountHolder(`${firstName.trim()} ${lastName.trim()}`);
    }
  };

  // Basic IBAN formatting & bank deduction
  const handleIbanChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let formatted = '';
    for (let i = 0; i < clean.length; i += 4) {
      formatted += clean.substring(i, i + 4) + ' ';
    }
    setIban(formatted.trim());

    // Auto-detect German Sparkasse / Volksbank / Postbank if possible
    if (clean.startsWith('DE')) {
      const blz = clean.substring(4, 12);
      if (!bic) {
        if (blz.startsWith('3705')) setBic('SPKDMUSTXXX');
        else if (blz.startsWith('3706')) setBic('GENODEM1MST');
      }
      if (!bankName) {
        if (blz.startsWith('3705')) setBankName('Sparkasse');
        else if (blz.startsWith('3706')) setBankName('Volksbank Raiffeisenbank');
      }
    }
  };

  // Fee calculation estimation
  const estimatedFee = useMemo(() => {
    if (templateSettings?.defaultFeeRules) {
      return templateSettings.defaultFeeRules[membershipType] || 15;
    }
    switch (membershipType) {
      case 'youth':
        return 10.0;
      case 'reduced':
        return 12.0;
      case 'family':
        return 30.0;
      case 'supporting':
        return 25.0;
      case 'full':
      default:
        return 18.0;
    }
  }, [membershipType, templateSettings]);

  // Validation per step
  const validateStep = (currentStep: number): boolean => {
    setErrorMsg(null);

    if (currentStep === 1) {
      if (!firstName.trim() || !lastName.trim()) {
        setErrorMsg('Bitte geben Sie Vor- und Nachnamen ein.');
        return false;
      }
      if (!birthDate) {
        setErrorMsg('Bitte geben Sie Ihr Geburtsdatum an.');
        return false;
      }
      if (!email.trim() || !email.includes('@')) {
        setErrorMsg('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
        return false;
      }
      if (!street.trim() || !houseNumber.trim() || !zip.trim() || !city.trim()) {
        setErrorMsg('Bitte vervollständigen Sie Ihre Wohnanschrift.');
        return false;
      }
      if (isMinor && !guardianName.trim()) {
        setErrorMsg('Da der Antragsteller minderjährig ist, muss ein gesetzlicher Vertreter angegeben werden.');
        return false;
      }
      return true;
    }

    if (currentStep === 2) {
      if (!department) {
        setErrorMsg('Bitte wählen Sie eine Sportart/Abteilung aus.');
        return false;
      }
      if (!entryDate) {
        setErrorMsg('Bitte geben Sie das gewünschte Eintrittsdatum an.');
        return false;
      }
      return true;
    }

    if (currentStep === 3) {
      if (paymentMethod === 'sepa') {
        const cleanIban = iban.replace(/\s+/g, '');
        if (cleanIban.length < 15) {
          setErrorMsg('Bitte geben Sie eine gültige IBAN für den SEPA-Lastschrifteinzug ein.');
          return false;
        }
        if (!accountHolder.trim()) {
          setErrorMsg('Bitte geben Sie den Namen des Kontoinhabers an.');
          return false;
        }
      }
      return true;
    }

    if (currentStep === 4) {
      if (!dataPrivacyConsent) {
        setErrorMsg('Die Einwilligung zur Datenverarbeitung (DSGVO) ist für den Vereinsbeitritt erforderlich.');
        return false;
      }
      if (!statuteConsent) {
        setErrorMsg('Die Anerkennung der Vereinssatzung ist für die Mitgliedschaft erforderlich.');
        return false;
      }
      if (!applicantSignature) {
        setErrorMsg('Bitte unterschreiben Sie den Aufnahmeantrag im vorgesehenen Unterschriftsfeld.');
        return false;
      }
      if (isMinor && !guardianSignature) {
        setErrorMsg('Für Minderjährige ist zwingend die Unterschrift des gesetzlichen Vertreters erforderlich.');
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNextStep = () => {
    if (validateStep(step)) {
      setStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    setErrorMsg(null);
    setStep(prev => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Compile final application data
  const compileApplication = (): OnlineMembershipApplication => {
    const now = new Date().toISOString();
    const cleanIban = iban.replace(/\s+/g, '');
    const appNum = `ANTRAG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      id: `app-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      applicationNumber: appNum,
      submittedAt: now,
      status: 'pending',
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender,
      birthDate,
      nationality: nationality.trim() || 'Deutsch',
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      address: {
        street: street.trim(),
        houseNumber: houseNumber.trim(),
        zip: zip.trim(),
        city: city.trim(),
        country: country.trim() || 'Deutschland'
      },
      department,
      membershipType,
      feeAmount: estimatedFee,
      feePeriod,
      entryDate,
      notes: notes.trim(),
      previousClub: previousClub.trim(),
      isMinor,
      guardianName: isMinor ? guardianName.trim() : undefined,
      guardianRelation: isMinor ? guardianRelation : undefined,
      guardianPhone: isMinor ? (guardianPhone.trim() || phone.trim()) : undefined,
      guardianEmail: isMinor ? (guardianEmail.trim() || email.trim()) : undefined,
      paymentMethod,
      bankDetails: {
        iban: cleanIban,
        bic: bic.trim() || 'SPKDMUSTXXX',
        bankName: bankName.trim() || 'Hausbank',
        accountHolder: accountHolder.trim() || `${firstName.trim()} ${lastName.trim()}`,
        mandateDate: now.slice(0, 10),
        mandateReference: `MANDAT-${appNum}`,
        monthlyDueDay
      },
      dataPrivacyConsent,
      statuteConsent,
      photoConsent,
      healthConfirmation,
      applicantSignature,
      applicantSignatureDate: now,
      guardianSignature: isMinor ? guardianSignature : undefined,
      guardianSignatureDate: isMinor ? now : undefined,
      sepaSignature: applicantSignature,
      sepaSignatureDate: now
    };
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const appData = compileApplication();
      await onSubmitApplication(appData);
      setSubmittedApp(appData);
      setStep(6); // Success screen
    } catch (err: any) {
      console.error('Fehler beim Absenden des Antrags:', err);
      setErrorMsg(err.message || 'Beim Absenden des Antrags ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview PDF in new tab
  const handlePreviewPdf = () => {
    try {
      const appData = compileApplication();
      const doc = generateMembershipApplicationPdf(appData, settings);
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      window.open(blobUrl, '_blank');
    } catch (e) {
      console.error('PDF Preview error:', e);
      setErrorMsg('Vorschau konnte nicht erzeugt werden. Bitte prüfen Sie Ihre Eingaben.');
    }
  };

  const handleDownloadPdf = () => {
    if (!submittedApp) return;
    const doc = generateMembershipApplicationPdf(submittedApp, settings);
    doc.save(`Aufnahmeantrag_${submittedApp.lastName}_${submittedApp.firstName}_${submittedApp.applicationNumber}.pdf`);
  };

  return (
    <div className={`w-full max-w-4xl mx-auto ${isStandalone ? 'min-h-screen py-6 px-4 bg-slate-900' : 'p-2'}`}>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        {/* 1. Header Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-200 border border-blue-400/30 rounded-full text-2xs font-bold uppercase tracking-wider">
                  {settings.associationNumber || 'Eingetragener Verein (e.V.)'}
                </span>
                <span className="inline-flex items-center gap-1 text-2xs text-emerald-300 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  SSL & DSGVO-konform
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {settings.clubName}
              </h1>
              <p className="text-sm text-blue-200/90 font-medium">
                Digitaler Aufnahmeantrag & Beitrittserklärung
              </p>
            </div>

            {/* Close button if inside modal */}
            {onClose && !isStandalone && (
              <button
                type="button"
                onClick={onClose}
                className="self-start sm:self-center px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Schließen
              </button>
            )}
          </div>

          {/* Stepper (Steps 1 to 5) */}
          {step < 6 && (
            <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-5 gap-2">
              {[
                { s: 1, label: 'Person', icon: User },
                { s: 2, label: 'Mitgliedschaft', icon: Users },
                { s: 3, label: 'Zahlung', icon: CreditCard },
                { s: 4, label: 'Unterschrift', icon: PenTool },
                { s: 5, label: 'Abschluss', icon: FileCheck2 }
              ].map(item => {
                const isCurrent = step === item.s;
                const isPassed = step > item.s;
                return (
                  <button
                    key={item.s}
                    type="button"
                    onClick={() => {
                      if (item.s < step) setStep(item.s);
                    }}
                    disabled={item.s > step}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-center transition-all ${
                      isCurrent
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : isPassed
                        ? 'bg-white/15 text-blue-100 hover:bg-white/25 cursor-pointer'
                        : 'text-white/40 cursor-not-allowed'
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5 shrink-0 hidden sm:inline-block" />
                    <span className="text-2xs sm:text-xs truncate">
                      {item.s}. {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Error Message Banner */}
        {errorMsg && (
          <div className="m-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="font-bold block">Eingabe unvollständig:</strong>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {/* 3. Form Content */}
        <div className="p-6 sm:p-8">
          {/* STEP 1: Persönliche Angaben */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  <span>1. Angaben zur Person</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bitte erfassen Sie die persönlichen Kontaktdaten des neuen Vereinsmitglieds.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Anrede / Geschlecht <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={gender}
                    onChange={e => setGender(e.target.value as Gender)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="m">Männlich</option>
                    <option value="w">Weiblich</option>
                    <option value="d">Divers</option>
                    <option value="none">Keine Angabe</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vorname <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="z.B. Lukas"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    onBlur={handleFirstNameBlur}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nachname <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="z.B. Weber"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    onBlur={handleFirstNameBlur}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Geburtsdatum <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={birthDate}
                    onChange={e => setBirthDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  {age !== null && (
                    <div className="mt-1 flex items-center gap-1.5 text-2xs font-semibold">
                      <span className="text-slate-600">Berechnetes Alter: {age} Jahre</span>
                      {isMinor ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          Minderjährig (unter 18)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Volljährig
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Staatsangehörigkeit
                  </label>
                  <input
                    type="text"
                    placeholder="z.B. Deutsch"
                    value={nationality}
                    onChange={e => setNationality(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-Mail-Adresse <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      placeholder="name@example.de"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Telefon / Mobilnummer
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      placeholder="z.B. 0171 1234567"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Anschrift */}
              <div className="pt-3 border-t border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <span>Wohnanschrift</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Straße <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="z.B. Sportplatzweg"
                      value={street}
                      onChange={e => setStreet(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Hausnummer <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="z.B. 12a"
                      value={houseNumber}
                      onChange={e => setHouseNumber(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Postleitzahl (PLZ) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="z.B. 12345"
                      value={zip}
                      onChange={e => setZip(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Wohnort <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="z.B. Musterstadt"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Land
                    </label>
                    <input
                      type="text"
                      value={country}
                      onChange={e => setCountry(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Erziehungsberechtigter bei Minderjährigen */}
              {isMinor && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <h3 className="text-xs font-bold text-amber-900">
                      Angaben zum gesetzlichen Vertreter (Minderjähriges Mitglied)
                    </h3>
                  </div>
                  <p className="text-2xs text-amber-800">
                    Da der Antragsteller unter 18 Jahre alt ist, ist die Angabe und Zustimmung eines Erziehungsberechtigten gesetzlich erforderlich.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Name d. gesetzl. Vertreters <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="z.B. Sandra Weber"
                        value={guardianName}
                        onChange={e => setGuardianName(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Verwandtschaftsverhältnis
                      </label>
                      <select
                        value={guardianRelation}
                        onChange={e => setGuardianRelation(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      >
                        <option value="Mutter">Mutter</option>
                        <option value="Vater">Vater</option>
                        <option value="Gesetzlicher Vormund">Gesetzlicher Vormund</option>
                        <option value="Sonstige">Sonstige Erziehungsberechtigte</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Telefonnummer Vertreter
                      </label>
                      <input
                        type="tel"
                        placeholder="Falls abweichend"
                        value={guardianPhone}
                        onChange={e => setGuardianPhone(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        E-Mail-Adresse Vertreter
                      </label>
                      <input
                        type="email"
                        placeholder="Falls abweichend"
                        value={guardianEmail}
                        onChange={e => setGuardianEmail(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Mitgliedschaft & Sparte */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span>2. Abteilung & Mitgliedschaft</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Wählen Sie die gewünschte Sportart und Beitragsgruppe aus.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sportabteilung / Sparte <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    {settings.departments.map(dept => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Gewünschter Beitrittstermin <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={e => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Mitgliedschafts-Typ Kacheln */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Beitragsgruppe / Mitgliedsart <span className="text-rose-500">*</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: isMinor ? 'youth' : 'full',
                      label: isMinor ? 'Kinder- & Jugendbeitrag' : 'Vollmitglied (Erwachsener)',
                      desc: isMinor ? 'Für Kinder und Jugendliche bis 18 Jahre' : 'Aktives Mitglied im Verein',
                      tag: isMinor ? 'Empfohlen für U18' : 'Standard'
                    },
                    {
                      id: 'reduced',
                      label: 'Ermäßigter Beitrag',
                      desc: 'Schüler, Studenten, Azubis, Schwerbehinderte, Rentner',
                      tag: 'Nachweis erforderlich'
                    },
                    {
                      id: 'family',
                      label: 'Familienbeitrag',
                      desc: 'Gemeinsamer Beitrag für Eltern und minderjährige Kinder',
                      tag: 'Familie'
                    },
                    {
                      id: 'supporting',
                      label: 'Fördermitglied (Passiv)',
                      desc: 'Unterstützung der Vereinsarbeit ohne aktive Sportteilnahme',
                      tag: 'Passiv'
                    }
                  ].map(card => {
                    const isSelected = membershipType === card.id;
                    return (
                      <div
                        key={card.id}
                        onClick={() => setMembershipType(card.id as MembershipType)}
                        className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer relative ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {card.tag}
                          </span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                        </div>
                        <h4 className="text-xs font-bold text-slate-900">{card.label}</h4>
                        <p className="text-2xs text-slate-500 mt-1">{card.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bisheriger Verein & Notizen */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bisheriger Verein / Passnummer (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="z.B. FC Vorwärts 08 (Spielerpass vorhanden)"
                    value={previousClub}
                    onChange={e => setPreviousClub(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bemerkungen / Ergänzende Angaben
                  </label>
                  <input
                    type="text"
                    placeholder="z.B. Wöchentliche Trainingsgruppe, Vorkenntnisse..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Zahlungsweise & SEPA-Lastschrift */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <span>3. Zahlungsweise & Lastschrifteinzug</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Legen Sie fest, wie der Mitgliedsbeitrag beglichen werden soll.
                </p>
              </div>

              {/* Zahlungsintervall */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Zahlungsweise / Intervall <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={feePeriod}
                    onChange={e => setFeePeriod(e.target.value as FeePeriod)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="monthly">Monatlich</option>
                    <option value="quarterly">Vierteljährlich (Quartal)</option>
                    <option value="half_yearly">Halbjährlich</option>
                    <option value="yearly">Jährlich (1x pro Jahr)</option>
                  </select>
                </div>

                {feePeriod === 'monthly' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Fälligkeitstag bei monatlichem Einzug
                    </label>
                    <select
                      value={monthlyDueDay}
                      onChange={e => setMonthlyDueDay(Number(e.target.value) as 1 | 15)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      <option value={1}>Jeweils zum 1. des Monats</option>
                      <option value={15}>Jeweils zum 15. des Monats</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Zahlungsmethode Wahl */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Zahlungsart <span className="text-rose-500">*</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'sepa',
                      label: 'SEPA-Basislastschrift',
                      desc: 'Bequemer und pünktlicher automatischer Bankeinzug (Empfohlen)',
                      badge: 'Empfohlen'
                    },
                    {
                      id: 'transfer',
                      label: 'Überweisung / Dauerauftrag',
                      desc: 'Eigenständige Überweisung auf das Vereinskonto',
                      badge: 'Selbstzahler'
                    },
                    {
                      id: 'cash',
                      label: 'Barzahlung',
                      desc: 'Barzahlung beim Kassenwart / Vereinsheim',
                      badge: 'Vor Ort'
                    }
                  ].map(method => {
                    const isSelected = paymentMethod === method.id;
                    return (
                      <div
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                        className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {method.badge}
                          </span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                        </div>
                        <h4 className="text-xs font-bold text-slate-900">{method.label}</h4>
                        <p className="text-2xs text-slate-500 mt-1">{method.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SEPA-Lastschrift Mandatsformular */}
              {paymentMethod === 'sepa' && (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-600" />
                      <span>SEPA-Lastschriftmandat</span>
                    </h3>
                    <span className="text-2xs font-mono text-slate-500">
                      Gläubiger-ID: {settings.creditorId || 'DE98ZZZ09999999999'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Kontoinhaber (Vor- und Nachname) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="z.B. Vor- und Nachname"
                        value={accountHolder}
                        onChange={e => setAccountHolder(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        IBAN (Internationale Kontonummer) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="DE00 0000 0000 0000 0000 00"
                        value={iban}
                        onChange={e => handleIbanChange(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Kreditinstitut / Bankname
                      </label>
                      <input
                        type="text"
                        placeholder="z.B. Sparkasse / Volksbank"
                        value={bankName}
                        onChange={e => setBankName(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        BIC (optional bei deutschen IBANs)
                      </label>
                      <input
                        type="text"
                        placeholder="z.B. SPKDMUSTXXX"
                        value={bic}
                        onChange={e => setBic(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden uppercase"
                      />
                    </div>
                  </div>

                  {/* Rechtlicher SEPA Text */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-2xs text-slate-600 leading-relaxed">
                    <strong>SEPA-Hinweis:</strong> Ich ermächtige {settings.clubName}, Zahlungen von meinem Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die vom Verein auf mein Konto gezogenen Lastschriften einzulösen. Hinweis: Ich kann innerhalb von 8 Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Rechtliches & Digitale Unterschriften */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <PenTool className="w-5 h-5 text-blue-600" />
                  <span>4. Rechtliche Erklärungen & Digitale Signatur</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bestätigen Sie die Satzungsbedingungen und unterschreiben Sie den Antrag digital direkt am Bildschirm.
                </p>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dataPrivacyConsent}
                    onChange={e => setDataPrivacyConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <div className="text-xs text-slate-700">
                    <strong className="text-slate-900 block">
                      Datenschutzhinweis (DSGVO) <span className="text-rose-500">*</span>
                    </strong>
                    <span>
                      Ich willige ein, dass meine personenbezogenen Daten ausschließlich für vereinsinterne Zwecke (Mitgliederverwaltung, Beitragsabrechnung, sportliche Organisation) gespeichert und verarbeitet werden. Eine Weitergabe an unbefugte Dritte findet nicht statt.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={statuteConsent}
                    onChange={e => setStatuteConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <div className="text-xs text-slate-700">
                    <strong className="text-slate-900 block">
                      Anerkennung der Vereinssatzung & Beitragsordnung <span className="text-rose-500">*</span>
                    </strong>
                    <span>
                      Ich erkenne die Vereinssatzung und Beitragsordnung von {settings.clubName} in der jeweils gültigen Fassung verbindlich an.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={photoConsent}
                    onChange={e => setPhotoConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <div className="text-xs text-slate-700">
                    <strong className="text-slate-900 block">
                      Einwilligung Foto- und Videoaufnahmen (Freiwillig)
                    </strong>
                    <span>
                      Ich bin damit einverstanden, dass Fotos/Videos von Wettkämpfen und Vereinsfesten im Rahmen der Berichterstattung auf der Vereinswebsite oder im Vereinsheft veröffentlicht werden dürfen.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={healthConfirmation}
                    onChange={e => setHealthConfirmation(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <div className="text-xs text-slate-700">
                    <strong className="text-slate-900 block">
                      Sporttauglichkeit & Gesundheitliche Eignung
                    </strong>
                    <span>
                      Ich bestätige, dass keine ärztlichen Bedenken gegen eine sportliche Betätigung im Verein vorliegen.
                    </span>
                  </div>
                </label>
              </div>

              {/* Unterschriften-Pads */}
              <div className="space-y-6 pt-2">
                {/* 1. Signatur Antragsteller */}
                <DigitalSignaturePad
                  id="applicant-signature"
                  label={
                    isMinor
                      ? 'Unterschrift des Antragstellers (Kind/Jugendlicher)'
                      : 'Unterschrift des Antragstellers / Mitglieds'
                  }
                  sublabel="Unterschreiben Sie direkt im Kasten mit dem Finger oder der Maus"
                  value={applicantSignature}
                  onChange={setApplicantSignature}
                  required={true}
                  signerName={`${firstName} ${lastName}`}
                />

                {/* 2. Signatur Gesetzlicher Vertreter falls minderjährig */}
                {isMinor && (
                  <div className="pt-3 border-t border-slate-200">
                    <DigitalSignaturePad
                      id="guardian-signature"
                      label="Unterschrift des gesetzlichen Vertreters"
                      sublabel={`Erziehungsberechtigte/r (${guardianName || 'Mutter/Vater'})`}
                      value={guardianSignature}
                      onChange={setGuardianSignature}
                      required={true}
                      signerName={guardianName}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: Zusammenfassung & Vorschau */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-blue-600" />
                  <span>5. Zusammenfassung & Verbindliches Absenden</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bitte prüfen Sie alle Angaben vor dem Absenden Ihres Aufnahmeantrags.
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Person */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-2xs flex items-center gap-1.5 mb-2">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>Persönliche Daten</span>
                  </h4>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Name:</span>
                    <strong className="text-slate-900">{lastName}, {firstName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Geburtsdatum:</span>
                    <span className="text-slate-800">{birthDate} ({age} Jahre)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Anschrift:</span>
                    <span className="text-slate-800">{street} {houseNumber}, {zip} {city}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">E-Mail:</span>
                    <span className="text-slate-800">{email}</span>
                  </div>
                  {isMinor && (
                    <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between text-amber-900 font-semibold">
                      <span>Gesetzl. Vertreter:</span>
                      <span>{guardianName} ({guardianRelation})</span>
                    </div>
                  )}
                </div>

                {/* Mitgliedschaft & Zahlung */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-2xs flex items-center gap-1.5 mb-2">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                    <span>Mitgliedschaft & Zahlungsart</span>
                  </h4>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Abteilung:</span>
                    <strong className="text-slate-900">{department}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mitgliedsart:</span>
                    <span className="text-slate-800">{getMembershipTypeLabel(membershipType)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Eintrittstermin:</span>
                    <span className="text-slate-800">{entryDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Zahlungsweise:</span>
                    <span className="text-slate-800">{getFeePeriodLabel(feePeriod)}</span>
                  </div>
                  {paymentMethod === 'sepa' && (
                    <div className="pt-2 mt-2 border-t border-slate-200 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Zahlungsart:</span>
                        <strong className="text-blue-700">SEPA-Lastschrift</strong>
                      </div>
                      <div className="flex justify-between font-mono text-[11px]">
                        <span className="text-slate-500">IBAN:</span>
                        <span className="text-slate-900">{iban}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* PDF Preview Trigger */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Vorschau des Aufnahmeantrags als PDF</h4>
                    <p className="text-2xs text-slate-600">
                      Betrachten Sie das fertig ausgefüllte Dokument inklusive digitaler Unterschrift vor dem Absenden.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePreviewPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-blue-700 text-xs font-semibold rounded-xl border border-blue-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>PDF Vorschau</span>
                </button>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Nach dem Absenden wird der Antrag verschlüsselt an die Vereinsverwaltung von <strong>{settings.clubName}</strong> übertragen. Nach kurzer Prüfung erhalten Sie eine offizielle Bestätigung per E-Mail.
                </span>
              </div>
            </div>
          )}

          {/* STEP 6: Erfolgsmeldung & Bestätigung */}
          {step === 6 && submittedApp && (
            <div className="py-8 text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold font-mono">
                  Antragsnummer: {submittedApp.applicationNumber}
                </span>
                <h2 className="text-2xl font-black text-slate-900">
                  Aufnahmeantrag erfolgreich eingereicht!
                </h2>
                <p className="text-xs text-slate-600">
                  Vielen Dank, <strong>{submittedApp.firstName} {submittedApp.lastName}</strong>! Ihr Antrag auf Mitgliedschaft im <strong>{settings.clubName}</strong> (Abteilung {submittedApp.department}) ist bei der Vereinsverwaltung eingegangen.
                </p>
              </div>

              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl max-w-md mx-auto text-left text-xs space-y-2">
                <h4 className="font-bold text-slate-900">Wie geht es jetzt weiter?</h4>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 text-2xs">
                  <li>Der Vorstand bzw. die Abteilungsleitung prüft Ihren Antrag.</li>
                  <li>Sie erhalten nach der Bestätigung eine Aufnahmebestätigung per E-Mail an <strong>{submittedApp.email}</strong>.</li>
                  <li>Ihr hinterlegtes SEPA-Lastschriftmandat wird erst nach Aufnahme aktiv.</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Ausgefüllten Aufnahmeantrag (PDF) herunterladen</span>
                </button>

                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Fenster schließen
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Navigation Controls (Back / Next / Submit) */}
          {step < 6 && (
            <div className="mt-8 pt-5 border-t border-slate-200 flex items-center justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Zurück</span>
                </button>
              ) : (
                <div />
              )}

              {step < 5 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <span>Weiter</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                  className={`inline-flex items-center gap-2 px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer ${
                    isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Wird übermittelt...' : 'Antrag jetzt verbindlich einreichen'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
