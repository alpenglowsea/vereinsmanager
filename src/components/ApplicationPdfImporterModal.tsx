import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  FileSearch,
  ArrowRight,
  ShieldCheck,
  Check,
  User,
  CreditCard,
  Building2,
  Calendar,
  Eye,
  RefreshCw
} from 'lucide-react';
import { OnlineMembershipApplication, ClubSettings } from '../types';

interface ApplicationPdfImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplicationImported: (app: OnlineMembershipApplication) => void;
  settings: ClubSettings;
}

export interface ExtractedApplicationData {
  firstName?: string;
  lastName?: string;
  gender?: 'm' | 'w' | 'd' | 'none';
  birthDate?: string;
  nationality?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    houseNumber?: string;
    zip?: string;
    city?: string;
    country?: string;
  };
  department?: string;
  membershipType?: 'full' | 'reduced' | 'youth' | 'family' | 'supporting' | 'honorary';
  feePeriod?: 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
  feeAmount?: number;
  entryDate?: string;
  paymentMethod?: 'sepa' | 'transfer' | 'cash' | 'standing_order';
  bankDetails?: {
    iban?: string;
    bic?: string;
    bankName?: string;
    accountHolder?: string;
    mandateDate?: string;
  };
  isMinor?: boolean;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  guardianRelation?: string;
  dataPrivacyConsent?: boolean;
  statuteConsent?: boolean;
  photoConsent?: boolean;
  healthConfirmation?: boolean;
  hasApplicantSignature?: boolean;
  hasGuardianSignature?: boolean;
  hasSepaSignature?: boolean;
  notes?: string;
  confidence?: number;
  rawExtractedTextSummary?: string;
}

export const ApplicationPdfImporterModal: React.FC<ApplicationPdfImporterModalProps> = ({
  isOpen,
  onClose,
  onApplicationImported,
  settings,
}) => {
  if (!isOpen) return null;

  // State
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedApplicationData | null>(null);

  // Form edit fields
  const [formData, setFormData] = useState<Partial<OnlineMembershipApplication>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Drag & drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleProcessFile = (selectedFile: File) => {
    setFile(selectedFile);
    setScanError(null);
    setExtractedData(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setFileDataUrl(dataUrl);
      // Automatically trigger AI extraction
      await runAiExtraction(dataUrl, selectedFile.type, selectedFile.name);
    };
    reader.onerror = () => {
      setScanError('Fehler beim Lesen der Datei.');
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(droppedFile.type) && !droppedFile.name.endsWith('.pdf')) {
        setScanError('Bitte laden Sie eine PDF-Datei oder ein Foto/Scan (JPG, PNG) des Antrags hoch.');
        return;
      }
      handleProcessFile(droppedFile);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  // Run AI Extraction via backend API
  const runAiExtraction = async (dataUrl: string, mimeType: string, fileName: string) => {
    setIsScanning(true);
    setScanError(null);

    try {
      const response = await fetch('/api/scan-application-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileDataUrl: dataUrl,
          mimeType: mimeType || 'application/pdf',
          fileName,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Die KI-Erkennung konnte die Datei nicht verarbeiten.');
      }

      const extracted: ExtractedApplicationData = result.data;
      setExtractedData(extracted);

      // Map to editable form data
      const mappedApp: Partial<OnlineMembershipApplication> = {
        firstName: extracted.firstName || '',
        lastName: extracted.lastName || '',
        gender: extracted.gender || 'none',
        birthDate: extracted.birthDate || '',
        nationality: extracted.nationality || 'Deutsch',
        phone: extracted.phone || '',
        email: extracted.email || '',
        address: {
          street: extracted.address?.street || '',
          houseNumber: extracted.address?.houseNumber || '',
          zip: extracted.address?.zip || '',
          city: extracted.address?.city || '',
          country: extracted.address?.country || 'Deutschland',
        },
        department: extracted.department || settings.departments[0] || 'Hauptverein',
        membershipType: extracted.membershipType || 'full',
        feePeriod: extracted.feePeriod || 'yearly',
        feeAmount: extracted.feeAmount || 0,
        entryDate: extracted.entryDate || new Date().toISOString().slice(0, 10),
        paymentMethod: extracted.paymentMethod || 'sepa',
        bankDetails: {
          iban: (extracted.bankDetails?.iban || '').replace(/\s+/g, ''),
          bic: (extracted.bankDetails?.bic || '').trim(),
          bankName: extracted.bankDetails?.bankName || '',
          accountHolder: extracted.bankDetails?.accountHolder || `${extracted.firstName || ''} ${extracted.lastName || ''}`.trim(),
          mandateDate: extracted.bankDetails?.mandateDate || new Date().toISOString().slice(0, 10),
          mandateReference: `MANDAT-${Date.now().toString().slice(-6)}`,
        },
        isMinor: Boolean(extracted.isMinor),
        guardianName: extracted.guardianName || '',
        guardianPhone: extracted.guardianPhone || '',
        guardianEmail: extracted.guardianEmail || '',
        guardianRelation: extracted.guardianRelation || '',
        dataPrivacyConsent: extracted.dataPrivacyConsent !== false,
        statuteConsent: extracted.statuteConsent !== false,
        photoConsent: Boolean(extracted.photoConsent),
        healthConfirmation: Boolean(extracted.healthConfirmation),
        notes: [
          extracted.notes,
          `Importiert aus Scan/PDF: ${fileName}`,
          extracted.hasApplicantSignature ? 'Handschriftliche Unterschrift Antragsteller erkannt' : null,
          extracted.hasGuardianSignature ? 'Handschriftliche Unterschrift Erziehungsberechtigter erkannt' : null,
          extracted.hasSepaSignature ? 'SEPA-Mandat unterschrieben' : null,
        ]
          .filter(Boolean)
          .join(' | '),
        pdfDataUrl: dataUrl,
      };

      setFormData(mappedApp);
    } catch (err: any) {
      console.error('Scan Error:', err);
      setScanError(err.message || 'Fehler bei der automatischen Texterkennung.');
    } finally {
      setIsScanning(false);
    }
  };

  // Submit and create application in the system
  const handleConfirmAndSave = () => {
    if (!formData.firstName?.trim() || !formData.lastName?.trim()) {
      alert('Bitte geben Sie mindestens Vor- und Nachnamen an.');
      return;
    }

    const appNumber = `ANTRAG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const fullApplication: OnlineMembershipApplication = {
      id: `app-scan-${Date.now()}`,
      applicationNumber: appNumber,
      submittedAt: new Date().toISOString(),
      status: 'pending',
      firstName: formData.firstName || '',
      lastName: formData.lastName || '',
      gender: formData.gender || 'none',
      birthDate: formData.birthDate || '',
      nationality: formData.nationality || 'Deutsch',
      phone: formData.phone || '',
      email: formData.email || '',
      address: {
        street: formData.address?.street || '',
        houseNumber: formData.address?.houseNumber || '',
        zip: formData.address?.zip || '',
        city: formData.address?.city || '',
        country: formData.address?.country || 'Deutschland',
      },
      department: formData.department || settings.departments[0] || 'Hauptverein',
      membershipType: formData.membershipType || 'full',
      feePeriod: formData.feePeriod || 'yearly',
      feeAmount: Number(formData.feeAmount) || 0,
      entryDate: formData.entryDate || new Date().toISOString().slice(0, 10),
      paymentMethod: formData.paymentMethod || 'sepa',
      bankDetails: {
        iban: formData.bankDetails?.iban || '',
        bic: formData.bankDetails?.bic || '',
        bankName: formData.bankDetails?.bankName || '',
        accountHolder: formData.bankDetails?.accountHolder || `${formData.firstName} ${formData.lastName}`,
        mandateDate: formData.bankDetails?.mandateDate || new Date().toISOString().slice(0, 10),
        mandateReference: formData.bankDetails?.mandateReference || `MANDAT-${appNumber}`,
        monthlyDueDay: 1,
      },
      isMinor: Boolean(formData.isMinor),
      guardianName: formData.guardianName || '',
      guardianPhone: formData.guardianPhone || '',
      guardianEmail: formData.guardianEmail || '',
      guardianRelation: formData.guardianRelation || '',
      dataPrivacyConsent: formData.dataPrivacyConsent !== false,
      statuteConsent: formData.statuteConsent !== false,
      photoConsent: Boolean(formData.photoConsent),
      healthConfirmation: Boolean(formData.healthConfirmation),
      notes: formData.notes || `Aus Original-PDF importiert (${file?.name})`,
      pdfDataUrl: fileDataUrl || undefined,
    };

    onApplicationImported(fullApplication);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Antrag per PDF / Scan importieren (KI-Erkennung)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-2xs font-bold border border-blue-200">
                  Automatische Texterkennung
                </span>
              </div>
              <p className="text-xs text-slate-500">
                PDF-Formulare oder abfotografierte handschriftliche Aufnahmeanträge automatisch auslesen und prüfen
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          
          {/* 1. Drag & Drop Zone */}
          {!extractedData && !isScanning && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-blue-500 bg-blue-50/70 scale-[1.01]'
                  : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">
                    PDF-Antrag oder Foto hier hineinziehen oder klicken zum Auswählen
                  </p>
                  <p className="text-xs text-slate-500">
                    Unterstützt eingescannte, handschriftlich ausgefüllte Anträge, PDF-Dokumente sowie Smartphone-Fotos (PDF, PNG, JPG)
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-4 text-2xs text-slate-400">
                  <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> DSGVO-konforme Analyse</span>
                  <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-blue-500" /> Handschrift-Erkennung</span>
                  <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-blue-500" /> SEPA-Mandate</span>
                </div>
              </div>
            </div>
          )}

          {/* Loading / Scanning Indicator */}
          {isScanning && (
            <div className="p-10 border border-blue-100 rounded-2xl bg-blue-50/50 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-200">
              <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-blue-600 animate-pulse" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-sm font-bold text-slate-900">
                  Dokument wird analysiert...
                </h3>
                <p className="text-xs text-slate-600">
                  Die KI liest Namen, Adressen, Geburtsdatum, Sparte, Unterschriften und SEPA-Bankdaten aus Ihrem Antrag aus.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {scanError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <strong className="font-semibold">Fehler beim Auslesen des Antrags</strong>
                <p className="text-slate-700 leading-relaxed">
                  {scanError.includes('503') || scanError.includes('high demand') || scanError.includes('UNAVAILABLE')
                    ? 'Der KI-Dienst ist im Moment kurzzeitig hoch ausgelastet. Dies ist in der Regel nur für wenige Sekunden der Fall.'
                    : scanError}
                </p>
                <div className="pt-1 flex items-center gap-3">
                  {file && fileDataUrl && (
                    <button
                      type="button"
                      onClick={() => runAiExtraction(fileDataUrl, file.type, file.name)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Jetzt erneut versuchen</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setScanError(null);
                      setExtractedData(null);
                      setFile(null);
                      setFileDataUrl(null);
                    }}
                    className="text-xs font-semibold text-rose-700 underline hover:text-rose-900 cursor-pointer"
                  >
                    Andere Datei wählen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. Extracted Data Verification & Editing Form */}
          {extractedData && !isScanning && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Summary Bar */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900">
                      Antrag erfolgreich ausgelesen ({file?.name})
                    </h4>
                    <p className="text-2xs text-emerald-700">
                      Bitte prüfen und korrigieren Sie die erfassten Daten vor der Übernahme.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-lg text-2xs font-semibold hover:bg-emerald-100 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Andere Datei wählen
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              {/* Status badges of recognized items */}
              <div className="flex flex-wrap gap-2 text-2xs">
                <span className={`px-2.5 py-1 rounded-md border font-medium flex items-center gap-1 ${
                  extractedData.hasApplicantSignature ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  <Check className="w-3 h-3 text-emerald-600" />
                  Unterschrift Antragsteller: {extractedData.hasApplicantSignature ? 'Erkannt' : 'Nicht sicher'}
                </span>
                {formData.isMinor && (
                  <span className={`px-2.5 py-1 rounded-md border font-medium flex items-center gap-1 ${
                    extractedData.hasGuardianSignature ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    <Check className="w-3 h-3 text-emerald-600" />
                    Unterschrift Erziehungsberechtigter: {extractedData.hasGuardianSignature ? 'Erkannt' : 'Bitte prüfen'}
                  </span>
                )}
                <span className={`px-2.5 py-1 rounded-md border font-medium flex items-center gap-1 ${
                  formData.bankDetails?.iban ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  <CreditCard className="w-3 h-3 text-blue-600" />
                  SEPA-IBAN: {formData.bankDetails?.iban ? 'Vorhanden' : 'Keine'}
                </span>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Persönliche Daten */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-800 font-bold text-xs">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>1. Persönliche Angaben</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">Vorname *</label>
                      <input
                        type="text"
                        value={formData.firstName || ''}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">Nachname *</label>
                      <input
                        type="text"
                        value={formData.lastName || ''}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">Geschlecht</label>
                      <select
                        value={formData.gender || 'none'}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="m">Männlich</option>
                        <option value="w">Weiblich</option>
                        <option value="d">Divers</option>
                        <option value="none">Keine Angabe</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">Geburtsdatum</label>
                      <input
                        type="date"
                        value={formData.birthDate || ''}
                        onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">E-Mail</label>
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">Telefon / Mobil</label>
                      <input
                        type="text"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Anschrift */}
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-2xs font-semibold text-slate-600 mb-1">Straße</label>
                        <input
                          type="text"
                          value={formData.address?.street || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              address: { ...formData.address!, street: e.target.value },
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-semibold text-slate-600 mb-1">Hausnr.</label>
                        <input
                          type="text"
                          value={formData.address?.houseNumber || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              address: { ...formData.address!, houseNumber: e.target.value },
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-2xs font-semibold text-slate-600 mb-1">PLZ</label>
                        <input
                          type="text"
                          value={formData.address?.zip || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              address: { ...formData.address!, zip: e.target.value },
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-2xs font-semibold text-slate-600 mb-1">Stadt / Ort</label>
                        <input
                          type="text"
                          value={formData.address?.city || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              address: { ...formData.address!, city: e.target.value },
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Sparte, Mitgliedschaft & Bankverbindung */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-800 font-bold text-xs">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>2. Abteilung & SEPA-Lastschrift</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">Sparte / Abteilung</label>
                      <select
                        value={formData.department || settings.departments[0] || 'Hauptverein'}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      >
                        {settings.departments.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">Mitgliedsart</label>
                      <select
                        value={formData.membershipType || 'full'}
                        onChange={(e) => setFormData({ ...formData, membershipType: e.target.value as any })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="full">Vollmitglied (Erwachsener)</option>
                        <option value="reduced">Ermäßigt (Schüler/Student)</option>
                        <option value="youth">Jugend / Kind</option>
                        <option value="family">Familienbeitrag</option>
                        <option value="supporting">Fördermitglied</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">Zahlungsart</label>
                      <select
                        value={formData.paymentMethod || 'sepa'}
                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="sepa">SEPA-Lastschrift</option>
                        <option value="transfer">Banküberweisung</option>
                        <option value="cash">Barzahlung</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">Intervall</label>
                      <select
                        value={formData.feePeriod || 'yearly'}
                        onChange={(e) => setFormData({ ...formData, feePeriod: e.target.value as any })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="yearly">Jährlich</option>
                        <option value="half_yearly">Halbjährlich</option>
                        <option value="quarterly">Vierteljährlich</option>
                        <option value="monthly">Monatlich</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">Beitrag (€)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={formData.feeAmount || 0}
                        onChange={(e) => setFormData({ ...formData, feeAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* SEPA Bankdaten */}
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">IBAN</label>
                      <input
                        type="text"
                        value={formData.bankDetails?.iban || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bankDetails: { ...formData.bankDetails!, iban: e.target.value.replace(/\s+/g, '') },
                          })
                        }
                        placeholder="DE..."
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-2xs font-semibold text-slate-600 mb-1">BIC</label>
                        <input
                          type="text"
                          value={formData.bankDetails?.bic || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankDetails: { ...formData.bankDetails!, bic: e.target.value },
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-semibold text-slate-600 mb-1">Kontoinhaber</label>
                        <input
                          type="text"
                          value={formData.bankDetails?.accountHolder || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankDetails: { ...formData.bankDetails!, accountHolder: e.target.value },
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Erziehungsberechtigter bei Minderjährigen */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.isMinor)}
                      onChange={(e) => setFormData({ ...formData, isMinor: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span>Antragsteller ist minderjährig (unter 18 Jahre)</span>
                  </label>
                </div>

                {formData.isMinor && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">Name Erziehungsberechtigter</label>
                      <input
                        type="text"
                        value={formData.guardianName || ''}
                        onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">Telefon Erziehungsberechtigter</label>
                      <input
                        type="text"
                        value={formData.guardianPhone || ''}
                        onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">Verhältnis (Mutter/Vater/Vormund)</label>
                      <input
                        type="text"
                        value={formData.guardianRelation || ''}
                        onChange={(e) => setFormData({ ...formData, guardianRelation: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Abbrechen
          </button>

          {extractedData && (
            <button
              type="button"
              onClick={handleConfirmAndSave}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Antrag zur Antragsliste hinzufügen & prüfen</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
