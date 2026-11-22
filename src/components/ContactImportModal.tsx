import { useState, useMemo, ChangeEvent, DragEvent, FC } from 'react';
import { ClubContact, ContactType } from '../types';
import {
  erkenneKontaktSpalten,
  wandleKontakteUm,
  mitArt,
  bereiteKontaktImportVor,
  KONTAKT_VORLAGE,
  KontaktSpalten,
  KontaktZeile,
  ArtVorgabe
} from '../services/kontaktImportService';
import Papa from 'papaparse';
import { leseImportDatei, XLSX_ACCEPT } from '../utils/importDatei';
import { melde } from '../utils/dialoge';
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  Download,
  Check,
  Search,
  ClipboardPaste
} from 'lucide-react';
import { CONTACT_TYPES_LIST } from '../data/contactConstants';
import { saveBlobAs } from '../utils/fileExportHelper';

interface ContactImportModalProps {
  existingContacts: ClubContact[];
  onImport: (newOrUpdatedContacts: ClubContact[]) => Promise<void> | void;
  onClose: () => void;
}

// Spaltenregeln, Umwandlung und Prüfungen stehen seit P18 in
// src/services/kontaktImportService.ts (mit Tests), wie Android.

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
  const [mapping, setMapping] = useState<KontaktSpalten>({});
  const [defaultContactType, setDefaultContactType] = useState<ContactType>('supplier');
  const [artVorgabe, setArtVorgabe] = useState<ArtVorgabe>('erkennen');
  const [zeilen, setZeilen] = useState<KontaktZeile[]>([]);
  const [searchPreview, setSearchPreview] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Kopfzeilen und Zeilen übernehmen (aus CSV-Text oder aus einer Excel-Datei, P28)
  const uebernimmTabelle = (headers: string[], rows: Record<string, string>[], sourceName: string) => {
    if (rows.length === 0) {
      setErrorMsg('Keine Datenzeilen in der angegebenen Datei / dem Text gefunden.');
      return;
    }
    if (headers.length === 0) {
      setErrorMsg('Es konnten keine Spaltenüberschriften erkannt werden.');
      return;
    }
    setFileName(sourceName);
    setCsvHeaders(headers);
    setRawRows(rows);
    setMapping(erkenneKontaktSpalten(headers));
    setStep(2);
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
      uebernimmTabelle(headers, parsed.data, sourceName);
    } catch (err: any) {
      setErrorMsg(`Fehler beim Einlesen: ${err.message || 'Unbekannter Fehler'}`);
    }
  };

  // Gewählte Datei: Excel (.xlsx) als Tabelle, sonst Text wie bisher (P28)
  const verarbeiteDatei = async (file: File) => {
    setErrorMsg(null);
    try {
      const d = await leseImportDatei(file);
      if (d.art === 'text' && d.hinweis) void melde(d.hinweis, 'Hinweis zur Datei');
      if (d.art === 'tabelle') uebernimmTabelle(d.tabelle.headers, d.tabelle.rows, file.name);
      else if (d.text) processCSVText(d.text, file.name);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Die Datei konnte nicht gelesen werden.');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void verarbeiteDatei(file);
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
    if (file) void verarbeiteDatei(file);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob(['\uFEFF' + KONTAKT_VORLAGE], { type: 'text/csv;charset=utf-8;' });
    void saveBlobAs(blob, 'kontakte_vorlage.csv');
  };

  // Vorschau erzeugen (beim Wechsel zu Schritt 3); Auswahl und Art lassen sich danach je Zeile ändern
  const zurVorschau = () => {
    setZeilen(wandleKontakteUm(rawRows, mapping, artVorgabe, defaultContactType, existingContacts));
    setStep(3);
  };

  const toggleZeile = (id: string) => {
    setZeilen(prev => prev.map(z => (z.id === id && z.fehler.length === 0 ? { ...z, selected: !z.selected } : z)));
  };

  const alleWaehlen = (an: boolean) => {
    setZeilen(prev => prev.map(z => ({ ...z, selected: an && z.fehler.length === 0 })));
  };

  const artWechseln = (id: string) => {
    setZeilen(prev => prev.map(z => (z.id === id ? mitArt(z, z.kontakt.personType === 'legal' ? 'natural' : 'legal', existingContacts) : z)));
  };

  const ausgewaehlt = zeilen.filter(z => z.selected && z.fehler.length === 0).length;
  const duplikate = zeilen.filter(z => z.duplikat).length;
  const mitFehler = zeilen.filter(z => z.fehler.length > 0).length;

  const filteredPreview = useMemo(() => {
    if (!searchPreview.trim()) return zeilen;
    const q = searchPreview.toLowerCase();
    return zeilen.filter(z =>
      z.kontakt.displayName.toLowerCase().includes(q) ||
      z.kontakt.email.toLowerCase().includes(q) ||
      (z.kontakt.address.city || '').toLowerCase().includes(q)
    );
  }, [zeilen, searchPreview]);

  const handleFinishImport = async () => {
    const neu = bereiteKontaktImportVor(zeilen, existingContacts);
    if (neu.length === 0) return;
    setIsSubmitting(true);
    try {
      await onImport(neu);
      onClose();
    } catch (err: any) {
      setErrorMsg(`Fehler beim Speichern: ${err.message || 'Unbekannter Fehler'}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base dark:text-white">
                Kontakte importieren (Excel, CSV & Tabellen)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Schritt {step} von 3: {step === 1 ? 'Datei auswählen oder einfügen' : step === 2 ? 'Spalten zuordnen' : 'Vorschau & Import bestätigen'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors dark:hover:text-slate-300 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Upload / Paste */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Tabs: File Upload vs Copy Paste */}
              <div className="flex gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveInputMode('file')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeInputMode === 'file'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Excel- oder CSV-Datei hochladen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputMode('paste')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeInputMode === 'paste'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
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
                      ? 'border-blue-500 bg-blue-50/50 scale-[0.99] dark:bg-blue-950/50'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3 dark:bg-blue-900/40 dark:text-blue-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1 dark:text-slate-100">
                    Excel- oder CSV-Datei hierher ziehen oder durchsuchen
                  </h4>
                  <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto dark:text-slate-400">
                    Unterstützt Excel-Dateien (.xlsx, erste Tabelle) sowie komma- oder semikolongetrennte UTF-8-CSV-Dateien aus Google Sheets, LibreOffice oder anderen Vereinsprogrammen.
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors">
                    <span>Datei auswählen</span>
                    <input
                      type="file"
                      accept={`.csv,text/csv,text/plain,${XLSX_ACCEPT}`}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Kopieren Sie Zeilen aus Ihrer Tabelle (Excel oder Google Sheets) und fügen Sie diese hier ein:
                  </p>
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                    placeholder="Name / Firma&#9;Rechtsform&#9;E-Mail&#9;Telefon&#9;Ort&#10;Sport Schmitt GmbH&#9;GmbH&#9;info@sport-schmitt.de&#9;03981 12345&#9;Neustrelitz"
                    className="w-full p-3 font-mono text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 dark:border-slate-800"
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
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs dark:bg-slate-800 dark:border-slate-800">
                <div>
                  <h5 className="font-bold text-slate-800 dark:text-slate-100">Mustervorlage herunterladen</h5>
                  <p className="text-slate-500 dark:text-slate-400">
                    Verwenden Sie unsere vorbereitete Vorlage mit allen Standardspalten für einen reibungslosen Import.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 font-semibold flex items-center gap-1.5 shrink-0 transition-colors dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-200"
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
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm dark:text-white">
                    Spaltenzuordnung ({fileName || 'Datei'})
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ordnen Sie die Spalten Ihrer Tabelle den entsprechenden Feldern zu.
                  </p>
                </div>
                <div className="text-xs text-slate-600 flex items-center gap-2 dark:text-slate-300">
                  <span>Art, wenn die Datei sie nicht angibt:</span>
                  <select
                    value={artVorgabe}
                    onChange={e => setArtVorgabe(e.target.value as ArtVorgabe)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-xs dark:border-slate-800 dark:bg-slate-900"
                  >
                    <option value="erkennen">Automatisch erkennen (Rechtsform)</option>
                    <option value="legal">Immer Firma</option>
                    <option value="natural">Immer Privatperson</option>
                  </select>
                  <span>Standard-Kontakttyp falls unbestimmt:</span>
                  <select
                    value={defaultContactType}
                    onChange={e => setDefaultContactType(e.target.value as ContactType)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-xs dark:border-slate-800 dark:bg-slate-900"
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
                  { key: 'firstName', label: 'Vorname (Privatperson)', required: false },
                  { key: 'lastName', label: 'Nachname (Privatperson)', required: false },
                  { key: 'salutation', label: 'Anrede', required: false },
                  { key: 'contactNumber', label: 'Kontaktnummer', required: false },
                  { key: 'personType', label: 'Personenart (Firma / Privat)', required: false },
                  { key: 'legalForm', label: 'Rechtsform (z.B. GmbH, e.V.)', required: false },
                  { key: 'contactPersonName', label: 'Ansprechpartner', required: false },
                  { key: 'types', label: 'Kontakttypen (Lieferant, Sponsor, etc.)', required: false },
                  { key: 'email', label: 'E-Mail-Adresse', required: false },
                  { key: 'phone', label: 'Telefonnummer', required: false },
                  { key: 'mobile', label: 'Mobilfunk', required: false },
                  { key: 'website', label: 'Webseite', required: false },
                  { key: 'street', label: 'Straße (mit Hausnummer, wenn nicht getrennt)', required: false },
                  { key: 'houseNumber', label: 'Hausnummer', required: false },
                  { key: 'zip', label: 'Postleitzahl (PLZ)', required: false },
                  { key: 'city', label: 'Ort / Stadt', required: false },
                  { key: 'country', label: 'Land', required: false },
                  { key: 'iban', label: 'IBAN', required: false },
                  { key: 'bic', label: 'BIC', required: false },
                  { key: 'bankName', label: 'Bank', required: false },
                  { key: 'accountHolder', label: 'Kontoinhaber', required: false },
                  { key: 'taxId', label: 'Steuernummer / USt-IdNr. (Firma)', required: false },
                  { key: 'commercialRegister', label: 'Handelsregister (Firma)', required: false },
                  { key: 'dateOfBirth', label: 'Geburtsdatum (Privatperson)', required: false },
                  { key: 'notes', label: 'Notizen / Bemerkungen', required: false },
                  { key: 'tags', label: 'Schlagwörter / Tags', required: false }
                ].map(field => {
                  const currentMapped = mapping[field.key as keyof KontaktSpalten] || '';
                  return (
                    <div
                      key={field.key}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-1.5 dark:border-slate-800 dark:bg-slate-800/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {field.label}
                          {field.required && <span className="text-rose-600 ml-1 dark:text-rose-400">*</span>}
                        </span>
                        {currentMapped && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold dark:text-emerald-300 dark:bg-emerald-950/40">
                            zugeordnet
                          </span>
                        )}
                      </div>
                      <select
                        value={currentMapped}
                        onChange={e =>
                          setMapping(prev => ({ ...prev, [field.key]: e.target.value || undefined }))
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-800"
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
                  <h4 className="font-bold text-slate-900 text-sm dark:text-white">
                    Vorschau: {ausgewaehlt} von {zeilen.length} Kontakt{zeilen.length === 1 ? '' : 'en'} ausgewählt
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Mögliche Duplikate (gleiche Nummer oder gleicher Name) sind abgewählt{duplikate > 0 ? ` (${duplikate})` : ''}.
                    {mitFehler > 0 && <span className="text-rose-600 dark:text-rose-400"> {mitFehler} Zeile(n) ohne Namen werden nicht übernommen.</span>}
                    {' '}Ein Klick auf „Firma“/„Privat“ wechselt die Art.
                  </p>
                </div>
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchPreview}
                    onChange={e => setSearchPreview(e.target.value)}
                    placeholder="Vorschau filtern..."
                    className="w-full pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg dark:border-slate-800"
                  />
                </div>
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-96 dark:border-slate-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={ausgewaehlt > 0 && ausgewaehlt === zeilen.length - mitFehler}
                          onChange={e => alleWaehlen(e.target.checked)}
                        />
                      </th>
                      <th className="py-2.5 px-3">Name / Firma</th>
                      <th className="py-2.5 px-3">Art</th>
                      <th className="py-2.5 px-3">Rolle(n)</th>
                      <th className="py-2.5 px-3">E-Mail / Tel</th>
                      <th className="py-2.5 px-3">Ort</th>
                      <th className="py-2.5 px-3">IBAN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPreview.map(z => {
                      const c = z.kontakt;
                      return (
                        <tr key={z.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/70 ${z.selected ? '' : 'opacity-60'}`}>
                          <td className="py-2 px-3 align-top">
                            <input
                              type="checkbox"
                              checked={z.selected}
                              disabled={z.fehler.length > 0}
                              onChange={() => toggleZeile(z.id)}
                            />
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900 align-top dark:text-white">
                            {c.displayName || '–'} {c.legalForm ? `(${c.legalForm})` : ''}
                            {c.contactNumber && <span className="ml-1 text-[11px] font-mono font-normal text-slate-400">{c.contactNumber}</span>}
                            {c.contactPerson?.lastName && (
                              <div className="text-[11px] text-slate-400 font-normal">
                                AP: {[c.contactPerson.firstName, c.contactPerson.lastName].filter(Boolean).join(' ')}
                              </div>
                            )}
                            {z.fehler.map(f => (
                              <div key={f} className="text-[11px] text-rose-600 font-semibold dark:text-rose-400">{f}</div>
                            ))}
                            {z.duplikat && (
                              <div className="text-[11px] text-amber-700 font-semibold dark:text-amber-300">Mögliches Duplikat: {z.duplikat}</div>
                            )}
                            {z.hinweise.map(h => (
                              <div key={h} className="text-[11px] text-slate-500 font-normal dark:text-slate-400">{h}</div>
                            ))}
                          </td>
                          <td className="py-2 px-3 align-top">
                            <button
                              type="button"
                              onClick={() => artWechseln(z.id)}
                              title="Art wechseln"
                              className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                c.personType === 'legal' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {c.personType === 'legal' ? 'Firma' : 'Privat'}
                            </button>
                          </td>
                          <td className="py-2 px-3 text-slate-600 align-top dark:text-slate-300">
                            {c.types.map(t => CONTACT_TYPES_LIST.find(x => x.id === t)?.label ?? t).join(', ')}
                          </td>
                          <td className="py-2 px-3 text-slate-600 align-top dark:text-slate-300">
                            <div>{c.email || '–'}</div>
                            <div className="text-[11px] text-slate-400">{c.phone || c.mobile || ''}</div>
                          </td>
                          <td className="py-2 px-3 text-slate-600 align-top dark:text-slate-300">
                            {[c.address.zip, c.address.city].filter(Boolean).join(' ') || '–'}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-600 align-top dark:text-slate-300">
                            {c.bankDetails?.iban ? `${c.bankDetails.iban.slice(0, 6)}...` : '–'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between dark:border-slate-800 dark:bg-slate-800">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((step - 1) as any)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold transition-colors dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-200"
              >
                Zurück
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white text-xs font-medium transition-colors dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Abbrechen
            </button>

            {step === 2 && (
              <button
                type="button"
                onClick={zurVorschau}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                Weiter zur Vorschau
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                disabled={isSubmitting || ausgewaehlt === 0}
                onClick={handleFinishImport}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{ausgewaehlt} Kontakte importieren</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
