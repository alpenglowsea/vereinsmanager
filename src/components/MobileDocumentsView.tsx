/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { ClubDocument, DocumentCategory, DocumentFolder, Member, Transaction } from '../types';
import { DocumentUploadModal } from './DocumentUploadModal';
import { DocumentViewerModal, CATEGORY_CONFIG } from './DocumentViewerModal';
import { lockClass, lockTitle } from '../utils/uiLock';
import {
  Search,
  Upload,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  ChevronRight,
  Lock,
  CheckCircle2,
  SlidersHorizontal,
  X
} from 'lucide-react';

/**
 * Dokumente (Mobil-Ansicht, schlank)
 * ---------------------------------------------------------------------------
 * Bewusst nur ansehen, suchen und hochladen — keine Ordnerverwaltung
 * (anlegen, löschen, verschieben von Ordnern). Das war deine ausdrückliche
 * Wahl gegenüber der vollen Dokumentenverwaltung.
 *
 * Zum Ansehen und Hochladen wird NICHTS neu gebaut: Beide Bildschirme sind
 * exakt dieselben Bauteile wie am Desktop (DocumentViewerModal,
 * DocumentUploadModal) — unverändert wiederverwendet, so wie schon die
 * Beleg-Kamera und die Audioaufnahme in den vorigen Schritten. Dass
 * DocumentViewerModal seine Schaltfläche "Metadaten bearbeiten" nur zeigt,
 * wenn man ihr eine onEdit-Funktion übergibt, ist der Grund, warum "schlank"
 * hier ganz ohne Sonderfall auskommt: Es wird schlicht keine onEdit-Funktion
 * übergeben.
 *
 * Einzige bewusste Ergänzung: Beim Hochladen kann weiterhin ein
 * VORHANDENER Ordner ausgewählt werden (die Auswahl steckt schon in
 * DocumentUploadModal) — das ist kein Anlegen/Verwalten von Ordnern,
 * sondern nur "wo soll die Datei hin", und hilft, dass am Desktop nicht
 * plötzlich alles im Hauptverzeichnis landet, was jemand unterwegs
 * hochgeladen hat.
 *
 * Filter & Sortierung (neu): Kategorie, Dateiformat, Jahr und Sortierung
 * übernehmen wörtlich dieselbe Logik wie am Desktop (DocumentsView.tsx) —
 * dieselben vier Sortieroptionen, dieselbe Erkennung von PDF/Bild/
 * Office/Text anhand Dateiendung und MIME-Typ. Die Bedienung (Filter-Knopf
 * mit Zähler-Abzeichen, aufklappbares Feld) folgt demselben Muster wie
 * gerade eben bei den Mitgliedern.
 *
 * Bewusste Abweichung vom bisherigen Verhalten: Die Liste sortierte bisher
 * nach Hochlade-Zeitpunkt (uploadDate). Jetzt ist "Neueste zuerst" — wie am
 * Desktop — nach dem DOKUMENTENDATUM (date, z. B. das Datum auf dem Beleg
 * selbst) sortiert, nicht nach dem technischen Zeitpunkt des Hochladens.
 * Das passt in aller Regel besser zum Inhalt, kann sich aber von der
 * bisherigen Reihenfolge unterscheiden, wenn ein älteres Dokument erst
 * kürzlich nachgetragen wurde.
 */

type FormatFilter = 'all' | 'pdf' | 'images' | 'office' | 'text';
type SortOption = 'date_desc' | 'date_asc' | 'title_asc' | 'size_desc';

const SORT_LABELS: Record<SortOption, string> = {
  date_desc: 'Neueste zuerst',
  date_asc: 'Älteste zuerst',
  title_asc: 'Titel (A-Z)',
  size_desc: 'Dateigröße (absteigend)'
};

interface MobileDocumentsViewProps {
  documents: ClubDocument[];
  folders: DocumentFolder[];
  members: Member[];
  transactions: Transaction[];
  /** Darf die Person im Bereich "Dokumente" etwas hochladen? */
  canEdit: boolean;
  onSaveDocuments: (docs: ClubDocument[]) => Promise<void>;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isPdfDoc(doc: ClubDocument): boolean {
  return doc.fileType.includes('pdf') || doc.fileName.toLowerCase().endsWith('.pdf');
}
function isImageDoc(doc: ClubDocument): boolean {
  return doc.fileType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(doc.fileName);
}
function isOfficeDoc(doc: ClubDocument): boolean {
  return (
    /\.(docx?|xlsx?|pptx?|odt|ods)$/i.test(doc.fileName) ||
    doc.fileType.includes('officedocument') ||
    doc.fileType.includes('msword') ||
    doc.fileType.includes('excel')
  );
}
function isTextDoc(doc: ClubDocument): boolean {
  return doc.fileType.includes('text') || doc.fileType.includes('csv') || /\.(txt|csv|log|md)$/i.test(doc.fileName);
}

function FileIcon({ doc }: { doc: ClubDocument }) {
  if (isImageDoc(doc)) return <ImageIcon className="w-4 h-4" />;
  if (isOfficeDoc(doc)) return <FileSpreadsheet className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
}

export function MobileDocumentsView({
  documents,
  folders,
  members,
  transactions,
  canEdit,
  onSaveDocuments
}: MobileDocumentsViewProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lastUploadCount, setLastUploadCount] = useState<number | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    documents.forEach(d => {
      const y = d.date?.split('-')[0];
      if (y) years.add(y);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [documents]);

  const activeFilterCount = [categoryFilter !== 'all', formatFilter !== 'all', yearFilter !== 'all'].filter(
    Boolean
  ).length;

  const resetFilters = () => {
    setCategoryFilter('all');
    setFormatFilter('all');
    setYearFilter('all');
  };

  const filteredDocuments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents
      .filter(d => {
        if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;

        if (formatFilter === 'pdf' && !isPdfDoc(d)) return false;
        if (formatFilter === 'images' && !isImageDoc(d)) return false;
        if (formatFilter === 'office' && !isOfficeDoc(d)) return false;
        if (formatFilter === 'text' && !isTextDoc(d)) return false;

        if (yearFilter !== 'all' && !(d.date || '').startsWith(yearFilter)) return false;

        if (q) {
          const categoryLabel = CATEGORY_CONFIG[d.category]?.label || '';
          const matches =
            d.title.toLowerCase().includes(q) ||
            d.fileName.toLowerCase().includes(q) ||
            categoryLabel.toLowerCase().includes(q) ||
            (d.tags || []).some(t => t.toLowerCase().includes(q)) ||
            (d.memberName || '').toLowerCase().includes(q);
          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') return (b.date || '').localeCompare(a.date || '');
        if (sortBy === 'date_asc') return (a.date || '').localeCompare(b.date || '');
        if (sortBy === 'title_asc') return a.title.localeCompare(b.title);
        if (sortBy === 'size_desc') return (b.fileSize || 0) - (a.fileSize || 0);
        return 0;
      });
  }, [documents, query, categoryFilter, formatFilter, yearFilter, sortBy]);

  const selectedDocument = selectedId ? documents.find(d => d.id === selectedId) ?? null : null;

  const handleUploadSave = async (docs: ClubDocument[]) => {
    await onSaveDocuments(docs);
    setLastUploadCount(docs.length);
  };

  return (
    <div className="p-4 space-y-3 pb-6">
      <button
        type="button"
        title={lockTitle(canEdit, 'Dokument hochladen')}
        onClick={() => {
          if (!canEdit) return;
          setLastUploadCount(null);
          setUploadOpen(true);
        }}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold cursor-pointer${lockClass(
          canEdit
        )}`}
      >
        <Upload className="w-4 h-4" />
        Dokument hochladen
      </button>

      {lastUploadCount !== null && (
        <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
          <p className="text-xs leading-snug">
            <strong>
              {lastUploadCount === 1 ? '1 Dokument' : `${lastUploadCount} Dokumente`} hochgeladen.
            </strong>{' '}
            Im Vereinsarchiv abgelegt.
          </p>
        </div>
      )}

      {!canEdit && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3">
          <Lock className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          <p className="text-xs leading-snug">
            <strong>Nur Leserecht.</strong> Sie können Dokumente einsehen, aber keine neuen hochladen.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Titel, Kategorie, Schlagwort …"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(o => !o)}
          className={`relative shrink-0 px-3 rounded-xl border cursor-pointer flex items-center justify-center ${
            filtersOpen || activeFilterCount > 0
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white border-slate-200 text-slate-500'
          }`}
          title="Filter & Sortierung"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 flex items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {filtersOpen && (
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Kategorie</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(CATEGORY_CONFIG) as DocumentCategory[]).map(cat => {
                const isActive = categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(isActive ? 'all' : cat)}
                    className={`px-2.5 py-1 rounded-full text-2xs font-bold cursor-pointer transition-colors ${
                      isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {CATEGORY_CONFIG[cat].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">Dateiformat</p>
              <select
                value={formatFilter}
                onChange={e => setFormatFilter(e.target.value as FormatFilter)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="all">Alle Formate</option>
                <option value="pdf">Nur PDFs</option>
                <option value="images">Bilder & Scans</option>
                <option value="office">Office & Tabellen</option>
                <option value="text">Textdateien & CSV</option>
              </select>
            </div>
            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">Jahr</p>
              <select
                value={yearFilter}
                onChange={e => setYearFilter(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="all">Alle Jahre</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 shrink-0">Sortieren</p>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="flex-1 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              {(Object.keys(SORT_LABELS) as SortOption[]).map(opt => (
                <option key={opt} value={opt}>
                  {SORT_LABELS[opt]}
                </option>
              ))}
            </select>
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-2xs font-semibold text-blue-600 cursor-pointer"
            >
              <X className="w-3 h-3" />
              Filter zurücksetzen
            </button>
          )}
        </div>
      )}

      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Keine Dokumente gefunden</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredDocuments.map(doc => {
            const categoryInfo = CATEGORY_CONFIG[doc.category];
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedId(doc.id)}
                className="w-full flex items-center justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-xl text-left cursor-pointer active:bg-slate-50"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-slate-100 text-slate-600 rounded-lg shrink-0">
                    <FileIcon doc={doc} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{doc.title}</p>
                    <p className="text-2xs text-slate-500 truncate">
                      {categoryInfo?.label || 'Sonstiges'} · {formatFileSize(doc.fileSize)}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {selectedDocument && <DocumentViewerModal document={selectedDocument} onClose={() => setSelectedId(null)} />}

      {uploadOpen && (
        <DocumentUploadModal
          isOpen={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onSaveDocuments={handleUploadSave}
          members={members}
          transactions={transactions}
          folders={folders}
        />
      )}
    </div>
  );
}
