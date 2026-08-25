import React, { useState } from 'react';
import { ClubDocument, DocumentCategory } from '../types';
import {
  X,
  Download,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Calendar,
  Tag,
  FileCode,
  FileSpreadsheet,
  Image as ImageIcon,
  HardDrive,
  User,
  Receipt,
  ExternalLink,
  Info
} from 'lucide-react';

interface DocumentViewerModalProps {
  document: ClubDocument | null;
  onClose: () => void;
  onEdit?: (doc: ClubDocument) => void;
}

export const CATEGORY_CONFIG: Record<DocumentCategory, { label: string; color: string; bg: string }> = {
  belege: { label: 'Buchhaltungsbeleg', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  vertraege: { label: 'Vertrag & Vereinbarung', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  satzung: { label: 'Satzung & Ordnung', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  protokolle: { label: 'Protokoll & Versammlung', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  mitglieder: { label: 'Mitglieder & Antrag', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  bescheide: { label: 'Finanzamt & Bescheid', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  sonstiges: { label: 'Sonstiges Dokument', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' }
};

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  document: doc,
  onClose,
  onEdit
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!doc) return null;

  const isPdf = doc.fileType.includes('pdf') || doc.fileName.toLowerCase().endsWith('.pdf') || doc.dataUrl.startsWith('data:application/pdf');
  const isImage = doc.fileType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(doc.fileName) || doc.dataUrl.startsWith('data:image/');
  const isText = doc.fileType.includes('text') || doc.fileType.includes('csv') || /\.(txt|csv|log|md|json)$/i.test(doc.fileName);
  const isOffice = /\.(docx?|xlsx?|pptx?|odt|ods)$/i.test(doc.fileName) || doc.fileType.includes('officedocument') || doc.fileType.includes('msword') || doc.fileType.includes('excel');

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDownload = () => {
    const link = window.document.createElement('a');
    link.href = doc.dataUrl;
    link.download = doc.fileName || `${doc.title}.pdf`;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const categoryInfo = CATEGORY_CONFIG[doc.category] || CATEGORY_CONFIG.sonstiges;

  return (
    <div id="document-viewer-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 md:p-6 animate-in fade-in duration-150">
      <div id="document-viewer-container" className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-slate-800 text-white rounded-xl shrink-0 shadow-xs">
              {isPdf && <FileText className="w-5 h-5" />}
              {isImage && <ImageIcon className="w-5 h-5" />}
              {isOffice && <FileSpreadsheet className="w-5 h-5" />}
              {isText && <FileCode className="w-5 h-5" />}
              {!isPdf && !isImage && !isOffice && !isText && <FileText className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-900 text-base truncate" title={doc.title}>
                  {doc.title}
                </h3>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${categoryInfo.bg} ${categoryInfo.color}`}>
                  {categoryInfo.label}
                </span>
                {doc.isReceipt && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <Receipt className="w-3 h-3" />
                    Buchungsbeleg
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate flex items-center gap-2 mt-0.5">
                <span>{doc.fileName}</span>
                <span>•</span>
                <span>{formatFileSize(doc.fileSize)}</span>
                <span>•</span>
                <span>Datum: {doc.date ? new Date(doc.date).toLocaleDateString('de-DE') : '-'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isImage && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                  className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Verkleinern"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-500 w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                  className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Vergrößern"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation(r => (r + 90) % 360)}
                  className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Drehen"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <div className="h-5 w-px bg-slate-200 mx-1" />
              </>
            )}

            <button
              id="btn-doc-download-view"
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors shadow-xs"
            >
              <Download className="w-4 h-4" />
              Herunterladen
            </button>

            {onEdit && (
              <button
                id="btn-doc-edit-view"
                type="button"
                onClick={() => onEdit(doc)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
              >
                Metadaten bearbeiten
              </button>
            )}

            <button
              id="btn-doc-viewer-close"
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Preview & Side Details */}
        <div className="flex-1 bg-slate-100 overflow-hidden flex flex-col md:flex-row min-h-[460px]">
          {/* Main Visual Preview */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-3 bg-slate-200/60 min-h-[380px]">
            {isPdf ? (
              <iframe
                src={doc.dataUrl}
                title={doc.title}
                className="w-full h-full min-h-[520px] rounded-lg border border-slate-300 shadow-sm bg-white"
              />
            ) : isImage ? (
              <div className="flex items-center justify-center p-4">
                <img
                  src={doc.dataUrl}
                  alt={doc.title}
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transition: 'transform 0.2s ease-out'
                  }}
                  className="max-h-[520px] max-w-full object-contain rounded-lg shadow-md border border-slate-300 bg-white"
                />
              </div>
            ) : (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md text-center">
                <div className="w-16 h-16 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  {isOffice ? <FileSpreadsheet className="w-8 h-8 text-emerald-600" /> : <FileText className="w-8 h-8 text-blue-600" />}
                </div>
                <h4 className="font-semibold text-slate-900 text-base mb-1">{doc.fileName}</h4>
                <p className="text-xs text-slate-500 mb-5">
                  Für diesen Dateityp ({doc.fileType || 'Binärdokument'}) steht eine Sofort-Download-Option zur Verfügung.
                </p>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Datei herunterladen ({formatFileSize(doc.fileSize)})
                </button>
              </div>
            )}
          </div>

          {/* Sidebar Metadata Info */}
          <div className="w-full md:w-72 bg-white border-t md:border-t-0 md:border-l border-slate-200 p-4 flex flex-col gap-4 text-xs overflow-y-auto shrink-0">
            <div>
              <h5 className="font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-slate-500" />
                Dokumentendetails
              </h5>
              
              <div className="space-y-2.5 text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Kategorie</span>
                  <span className="font-medium text-slate-800">{categoryInfo.label}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Dokumentendatum</span>
                  <span className="font-medium text-slate-800">{doc.date ? new Date(doc.date).toLocaleDateString('de-DE') : 'Kein Datum hinterlegt'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Dateiname & Größe</span>
                  <span className="font-mono text-[11px] text-slate-700 block truncate">{doc.fileName}</span>
                  <span className="text-slate-500 text-[11px]">{formatFileSize(doc.fileSize)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Archiviert am</span>
                  <span className="text-slate-700">{doc.uploadDate ? new Date(doc.uploadDate).toLocaleString('de-DE') : '-'}</span>
                </div>
              </div>
            </div>

            {/* Verknüpfungen */}
            {(doc.transactionDocNumber || doc.memberName) && (
              <div className="pt-3 border-t border-slate-100">
                <h5 className="font-semibold text-slate-900 mb-2">Verknüpfungen</h5>
                {doc.transactionDocNumber && (
                  <div className="mb-2 p-2 bg-amber-50 rounded-lg border border-amber-100 text-amber-900">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Receipt className="w-3.5 h-3.5" />
                      Buchungsbeleg: {doc.transactionDocNumber}
                    </div>
                  </div>
                )}
                {doc.memberName && (
                  <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100 text-indigo-900">
                    <div className="flex items-center gap-1.5 font-medium">
                      <User className="w-3.5 h-3.5" />
                      Mitglied: {doc.memberName}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Schlagworte / Tags */}
            {doc.tags && doc.tags.length > 0 && (
              <div className="pt-3 border-t border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-1.5">Schlagworte</span>
                <div className="flex flex-wrap gap-1">
                  {doc.tags.map((t, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-medium">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notizen */}
            {doc.notes && (
              <div className="pt-3 border-t border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-1">Notizen / Bemerkung</span>
                <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] leading-relaxed whitespace-pre-wrap">
                  {doc.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="truncate">GoBD-konform & revisionssicher im lokalen Vereinsarchiv (IndexedDB) abgelegt.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium text-xs transition-colors shrink-0 ml-2"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
