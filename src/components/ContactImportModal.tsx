import { useState, useMemo, ChangeEvent, DragEvent, FC } from 'react';
import { ClubContact, ContactPersonType, ContactType } from '../types';
import Papa from 'papaparse';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Building2,
  Table,
  Check,
  Search,
  ClipboardPaste,
  HelpCircle
} from 'lucide-react';
import { CONTACT_TYPES_LIST } from '../data/contactConstants';

interface ContactImportModalProps {
  existingContacts: ClubContact[];
  onImport: (newOrUpdatedContacts: ClubContact[]) => Promise<void> | void;
  onClose: () => void;
}

type ColumnMapping = {
  displayName?: string;
  personType?: string;
  companyName?: string;
  legalForm?: string;
  contactPersonName?: string;
  types?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  street?: string;
  houseNumber?: string;
  zip?: string;
  city?: string;
  country?: string;
  iban?: string;
  bic?: string;
  bankName?: string;
  notes?: string;
  tags?: string;
};

const SAMPLE_CSV_TEMPLATE = `Name / Firma;Personenart;Rechtsform;Kontakttypen;Ansprechpartner;E-Mail;Telefon;Straße;PLZ;Ort;IBAN;BIC;Notizen
Sport Schmitt GmbH;Firma;GmbH;Lieferant, Service;Schmitt, Thomas;info@sport-schmitt.de;03981 445566;Markt 12;17235;Neustrelitz;DE89370400440532013000;COBADEFFXXX;Sportkleidung & Bälle
Malerbetrieb Farbenfroh e.K.;Firma;e.K.;Sponsor, Dienstleister;Meier, Sandra;kontakt@farbenfroh.de;03981 123456;Seestr. 4;17235;Neustrelitz;DE12345678901234567890;GENODEF1XXX;Bandenwerbung Hauptplatz
Dr. Markus Weber;Privat;;Spender, Förderer;;dr.weber@beispiel.de;0171 9988776;Bahnhofstr. 8;17235;Neustrelitz;;;Regelmäßiger Förderer Jugendbereich
Kreissportbund Meckl.-Seenplatte;Firma;e.V.;Verband, Behörde;Schmidt, Peter;info@ksb-seenplatte.de;0395 554433;Am Wall 1;17033;Neubrandenburg;;;Dachverband`;

export const ContactImportModal: FC<ContactImportModalProps> = ({
  existingContacts,
  onImport,
  onClose
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeInputMode, setActiveInputMode] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState<string>('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [defaultContactType, setDefaultContactType] = useState<ContactType>('supplier');
  const [searchPreview, setSearchPreview] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-detection of column mapping
  const autoDetectMapping = (headers: string[]): ColumnMapping => {
    const map: ColumnMapping = {};
    const norm = (str: string) => str.toLowerCase().replace(/[^a-z0-9äöüß]/gi, '');

    headers.forEach(h => {
      const n = norm(h);
      if (!map.displayName && (n.includes('name') || n.includes('firma') || n.includes('bezeichnung') || n.includes('partner'))) {
        map.displayName = h;
      } else if (!map.personType && (n.includes('art') || n.includes('person') || n.includes('typ'))) {
        map.personType = h;
      } else if (!map.legalForm && (n.includes('rechtsform') || n.includes('form'))) {
        map.legalForm = h;
      } else if (!map.contactPersonName && (n.includes('ansprechpartner') || n.includes('kontaktperson') || n.includes('vertreter'))) {
        map.contactPersonName = h;
      } else if (!map.types && (n.includes('kontakttyp') || n.includes('rolle') || n.includes('kategorie'))) {
        map.types = h;
      } else if (!map.email && (n.includes('mail') || n.includes('email') || n.includes('postfach'))) {
        map.email = h;
      } else if (!map.phone && (n.includes('tel') || n.includes('festnetz') || n.includes('fon'))) {
        map.phone = h;
      } else if (!map.mobile && (n.includes('mobil') || n.includes('handy') || n.includes('cell'))) {
        map.mobile = h;
      } else if (!map.street && (n.includes('stra') || n.includes('adresse') || n.includes('anschrift'))) {
        map.street = h;
      } else if (!map.houseNumber && (n.includes('hausnr') || n.includes('nr'))) {
        map.houseNumber = h;
      } else if (!map.zip && (n.includes('plz') || n.includes('postleitzahl'))) {
        map.zip = h;
      } else if (!map.city && (n.includes('ort') || n.includes('stadt') || n.includes('wohnort'))) {
        map.city = h;
      } else if (!map.iban && n.includes('iban')) {
        map.iban = h;
      } else if (!map.bic && (n.includes('bic') || n.includes('swift'))) {
        map.bic = h;
      } else if (!map.bankName && (n.includes('bank') || n.includes('institut'))) {
        map.bankName = h;
      } else if (!map.notes && (n.includes('notiz') || n.includes('bemerk') || n.includes('kommentar'))) {
        map.notes = h;
      } else if (!map.tags && (n.includes('tag') || n.includes('stichwort') || n.includes('schlagwort'))) {
        map.tags = h;
      }
    });

    return map;
  };

  const processCSVText = (text: string, sourceName: string) => {
    setErrorMsg(null);
    try {
      const parsed = Papa.parse<Record<string, string>>(text.trim(), {
        header: true,
        skipEmptyLines: 'greedy',
        dynamicTyping: false
      });

      if (!parsed.data || parsed.data.length === 0) {
        setErrorMsg('Keine Datenzeilen in der angegebenen Datei / dem Text gefunden.');
        return;
      }

      const headers = parsed.meta.fields || Object.keys(parsed.data[0] || {});
      if (headers.length === 0) {
        setErrorMsg('Es konnten keine Spaltenüberschriften erkannt werden.');
        return;
      }

      setFileName(sourceName);
      setCsvHeaders(headers);
      setRawRows(parsed.data);
      setMapping(autoDetectMapping(headers));
      setStep(2);
    } catch (err: any) {
      setErrorMsg(`Fehler beim Einlesen: ${err.message || 'Unbekannter Fehler'}`);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      const text = evt.target?.result as string;
      if (text) {
        processCSVText(text, file.name);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = evt => {
        const text = evt.target?.result as string;
        if (text) {
          processCSVText(text, file.name);
        }
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob(['\uFEFF' + SAMPLE_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kontakte_vorlage.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Build mapped contacts for preview
  const parsedContacts = useMemo((): ClubContact[] => {
    if (step < 2) return [];

    return rawRows.map((row, idx) => {
      const rawName = (mapping.displayName ? row[mapping.displayName] : '') || `Kontakt ${idx + 1}`;
      const rawType = (mapping.personType ? row[mapping.personType] : '')?.toLowerCase();
      const isLegal = rawType?.includes('firma') || rawType?.includes('juristisch') || rawType?.includes('gmbh') || rawType?.includes('ev') || rawType?.includes('ug') || (!rawType && rawName.toLowerCase().includes('gmbh'));
      const personType: ContactPersonType = isLegal ? 'legal' : 'natural';

      // Types list
      const rawTypesCol = mapping.types ? row[mapping.types] : '';
      const typesList: ContactType[] = [];
      if (rawTypesCol) {
        const lower = rawTypesCol.toLowerCase();
        if (lower.includes('liefer') || lower.includes('waren')) typesList.push('supplier');
        if (lower.includes('dienst') || lower.includes('service') || lower.includes('handwerk')) typesList.push('service');
        if (lower.includes('spons')) typesList.push('sponsor');
        if (lower.includes('spend') || lower.includes('förder')) typesList.push('donor');
        if (lower.includes('behörd') || lower.includes('amt') || lower.includes('gemeinde')) typesList.push('authority');
        if (lower.includes('verband') || lower.includes('bund')) typesList.push('association');
        if (lower.includes('kooper') || lower.includes('partner')) typesList.push('partner');
      }
      if (typesList.length === 0) {
        typesList.push(defaultContactType);
      }

      // Contact person
      const rawAP = mapping.contactPersonName ? row[mapping.contactPersonName] : '';
      let contactPerson = undefined;
      if (rawAP) {
        const parts = rawAP.split(/[,;\s]+/).filter(Boolean);
        contactPerson = {
          salutation: 'Herr/Frau',
          firstName: parts[1] || '',
          lastName: parts[0] || rawAP,
          roleOrPosition: 'Ansprechpartner'
        };
      }

      const tagsList = (mapping.tags ? row[mapping.tags] : '')
        ?.split(/[,;]+/)
        .map(s => s.trim())
        .filter(Boolean) || [];

      const contact: ClubContact = {
        id: `contact_imp_${Date.now()}_${idx}`,
        contactNumber: `K-${1000 + existingContacts.length + idx + 1}`,
        personType,
        displayName: rawName.trim(),
        companyName: isLegal ? rawName.trim() : undefined,
        legalForm: mapping.legalForm ? row[mapping.legalForm] : undefined,
        contactPerson,
        types: typesList,
        email: mapping.email ? row[mapping.email]?.trim() || '' : '',
        phone: mapping.phone ? row[mapping.phone]?.trim() || '' : '',
        mobile: mapping.mobile ? row[mapping.mobile]?.trim() || '' : '',
        website: mapping.website ? row[mapping.website]?.trim() || '' : '',
        address: {
          street: mapping.street ? row[mapping.street]?.trim() || '' : '',
          houseNumber: mapping.houseNumber ? row[mapping.houseNumber]?.trim() || '' : '',
          zip: mapping.zip ? row[mapping.zip]?.trim() || '' : '',
          city: mapping.city ? row[mapping.city]?.trim() || '' : '',
          country: mapping.country ? row[mapping.country]?.trim() || 'Deutschland' : 'Deutschland'
        },
        bankDetails: {
          iban: mapping.iban ? (row[mapping.iban] || '').replace(/\s+/g, '').toUpperCase() : '',
          bic: mapping.bic ? (row[mapping.bic] || '').replace(/\s+/g, '').toUpperCase() : '',
          bankName: mapping.bankName ? row[mapping.bankName] || '' : '',
          accountHolder: rawName.trim()
        },
        notes: mapping.notes ? row[mapping.notes]?.trim() || '' : '',
        tags: tagsList,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      return contact;
    });
  }, [step, rawRows, mapping, defaultContactType, existingContacts.length]);

  const filteredPreview = useMemo(() => {
    if (!searchPreview.trim()) return parsedContacts;
    const q = searchPreview.toLowerCase();
    return parsedContacts.filter(c =>
      c.displayName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.address.city || '').toLowerCase().includes(q)
    );
  }, [parsedContacts, searchPreview]);

  const handleFinishImport = async () => {
    if (parsedContacts.length === 0) return;
    setIsSubmitting(true);
    try {
      await onImport(parsedContacts);
      onClose();
    } catch (err: any) {
      setErrorMsg(`Fehler beim Speichern: ${err.message || 'Unbekannter Fehler'}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Kontakte importieren (CSV & Tabellen)
              </h3>
              <p className="text-xs text-slate-500">
                Schritt {step} von 3: {step === 1 ? 'Datei auswählen oder einfügen' : step === 2 ? 'Spalten zuordnen' : 'Vorschau & Import bestätigen'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Upload / Paste */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Tabs: File Upload vs Copy Paste */}
              <div className="flex gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveInputMode('file')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeInputMode === 'file'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>CSV-Datei hochladen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputMode('paste')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeInputMode === 'paste'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <ClipboardPaste className="w-4 h-4" />
                  <span>Aus Excel / Google Sheets einfügen</span>
                </button>
              </div>

              {activeInputMode === 'file' ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">
                    CSV-Datei hierher ziehen oder durchsuchen
                  </h4>
                  <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">
                    Unterstützt kommagetrennte oder semikolongetrennte UTF-8 CSV-Dateien aus Microsoft Excel, Google Sheets, LibreOffice oder anderen Vereinsprogrammen.
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors">
                    <span>Datei auswählen</span>
                    <input
                      type="file"
                      accept=".csv,text/csv,text/plain"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Kopieren Sie Zeilen aus Ihrer Tabelle (Excel oder Google Sheets) und fügen Sie diese hier ein:
                  </p>
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                    placeholder="Name / Firma&#9;Rechtsform&#9;E-Mail&#9;Telefon&#9;Ort&#10;Sport Schmitt GmbH&#9;GmbH&#9;info@sport-schmitt.de&#9;03981 12345&#9;Neustrelitz"
                    className="w-full p-3 font-mono text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    disabled={!pastedText.trim()}
                    onClick={() => processCSVText(pastedText, 'Zwischenablage')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                  >
                    Eingefügte Daten analysieren
                  </button>
                </div>
              )}

              {/* Template Download Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div>
                  <h5 className="font-bold text-slate-800">Mustervorlage herunterladen</h5>
                  <p className="text-slate-500">
                    Verwenden Sie unsere vorbereitete Vorlage mit allen Standardspalten für einen reibungslosen Import.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Muster-CSV</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Column Mapping */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-200">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Spaltenzuordnung ({fileName || 'Datei'})
                  </h4>
                  <p className="text-xs text-slate-500">
                    Ordnen Sie die Spalten Ihrer Tabelle den entsprechenden Feldern zu.
                  </p>
                </div>
                <div className="text-xs text-slate-600 flex items-center gap-2">
                  <span>Standard-Kontakttyp falls unbestimmt:</span>
                  <select
                    value={defaultContactType}
                    onChange={e => setDefaultContactType(e.target.value as ContactType)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-xs"
                  >
                    {CONTACT_TYPES_LIST.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mapping Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                {[
                  { key: 'displayName', label: 'Name / Firmenname', required: true },
                  { key: 'personType', label: 'Personenart (Firma / Privat)', required: false },
                  { key: 'legalForm', label: 'Rechtsform (z.B. GmbH, e.V.)', required: false },
                  { key: 'contactPersonName', label: 'Ansprechpartner', required: false },
                  { key: 'types', label: 'Kontakttypen (Lieferant, Sponsor, etc.)', required: false },
                  { key: 'email', label: 'E-Mail-Adresse', required: false },
                  { key: 'phone', label: 'Telefonnummer', required: false },
                  { key: 'mobile', label: 'Mobilfunk', required: false },
                  { key: 'website', label: 'Webseite', required: false },
                  { key: 'street', label: 'Straße & Hausnummer', required: false },
                  { key: 'zip', label: 'Postleitzahl (PLZ)', required: false },
                  { key: 'city', label: 'Ort / Stadt', required: false },
                  { key: 'iban', label: 'IBAN', required: false },
                  { key: 'bic', label: 'BIC', required: false },
                  { key: 'notes', label: 'Notizen / Bemerkungen', required: false },
                  { key: 'tags', label: 'Schlagwörter / Tags', required: false }
                ].map(field => {
                  const currentMapped = (mapping as any)[field.key] || '';
                  return (
                    <div
                      key={field.key}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          {field.label}
                          {field.required && <span className="text-rose-600 ml-1">*</span>}
                        </span>
                        {currentMapped && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                            zugeordnet
                          </span>
                        )}
                      </div>
                      <select
                        value={currentMapped}
                        onChange={e =>
                          setMapping(prev => ({ ...prev, [field.key]: e.target.value || undefined }))
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">– Nicht zuordnen –</option>
                        {csvHeaders.map(header => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Preview */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Vorschau: {parsedContacts.length} Kontakt{parsedContacts.length === 1 ? '' : 'e'} bereit zum Import
                  </h4>
                  <p className="text-xs text-slate-500">
                    Überprüfen Sie die erkannten Datensätze vor der endgültigen Übernahme.
                  </p>
                </div>
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchPreview}
                    onChange={e => setSearchPreview(e.target.value)}
                    placeholder="Vorschau filtern..."
                    className="w-full pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Name / Firma</th>
                      <th className="py-2.5 px-3">Art</th>
                      <th className="py-2.5 px-3">Rolle(n)</th>
                      <th className="py-2.5 px-3">E-Mail / Tel</th>
                      <th className="py-2.5 px-3">Ort</th>
                      <th className="py-2.5 px-3">IBAN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPreview.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {c.displayName} {c.legalForm ? `(${c.legalForm})` : ''}
                          {c.contactPerson?.lastName && (
                            <div className="text-[11px] text-slate-400 font-normal">
                              AP: {c.contactPerson.lastName}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            c.personType === 'legal' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {c.personType === 'legal' ? 'Firma' : 'Privat'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {c.types.join(', ')}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          <div>{c.email || '–'}</div>
                          <div className="text-[11px] text-slate-400">{c.phone || c.mobile || ''}</div>
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {[c.address.zip, c.address.city].filter(Boolean).join(' ') || '–'}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                          {c.bankDetails?.iban ? `${c.bankDetails.iban.slice(0, 6)}...` : '–'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((step - 1) as any)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold transition-colors"
              >
                Zurück
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white text-xs font-medium transition-colors"
            >
              Abbrechen
            </button>

            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                Weiter zur Vorschau
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                disabled={isSubmitting || parsedContacts.length === 0}
                onClick={handleFinishImport}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{parsedContacts.length} Kontakte importieren</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
