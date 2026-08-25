import React, { useState, useRef } from 'react';
import { ClubDocument, DocumentCategory, DocumentFolder, Member, Transaction } from '../types';
import {
  X,
  Upload,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  CheckCircle2,
  Trash2,
  Tag,
  Calendar,
  Folder,
  AlertCircle,
  Plus
} from 'lucide-react';
import { CATEGORY_CONFIG } from './DocumentViewerModal';

interface DocumentUploadModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSave?: (docs: ClubDocument[]) => Promise<void>;
  onSaveDocuments?: (docs: ClubDocument[]) => Promise<void>;
  members?: Member[];
  transactions?: Transaction[];
  folders?: DocumentFolder[];
  initialCategory?: DocumentCategory;
  initialFolderId?: string | null;
  defaultCategory?: DocumentCategory;
}

interface UploadQueueItem {
  id: string;
  file: File;
  title: string;
  category: DocumentCategory;
  folderId?: string | null;
  date: string;
  dataUrl: string;
  fileSize: number;
  fileType: string;
  tags: string[];
  notes: string;
  memberId?: string;
  memberName?: string;
  transactionId?: string;
  transactionDocNumber?: string;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen = true,
  onClose,
  onSave,
  onSaveDocuments,
  members = [],
  transactions = [],
  folders = [],
  initialCategory,
  initialFolderId = null,
  defaultCategory = 'sonstiges'
}) => {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fallbackCategory: DocumentCategory = initialCategory || defaultCategory || 'sonstiges';

  if (!isOpen) return null;

  const handleFiles = async (files: FileList | File[]) => {
    setErrorMsg(null);
    const newItems: UploadQueueItem[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const titleWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[_\\-]/g, ' ');
        
        let autoCategory: DocumentCategory = fallbackCategory;
        const nameLower = file.name.toLowerCase();
        if (nameLower.includes('beleg') || nameLower.includes('rechnung') || nameLower.includes('quittung')) {
          autoCategory = 'belege';
        } else if (nameLower.includes('vertrag') || nameLower.includes('vereinbarung') || nameLower.includes('pacht')) {
          autoCategory = 'vertraege';
        } else if (nameLower.includes('satzung') || nameLower.includes('ordnung')) {
          autoCategory = 'satzung';
        } else if (nameLower.includes('protokoll') || nameLower.includes('niederschrift') || nameLower.includes('jhv')) {
          autoCategory = 'protokolle';
        } else if (nameLower.includes('antrag') || nameLower.includes('mitglied') || nameLower.includes('sepa')) {
          autoCategory = 'mitglieder';
        } else if (nameLower.includes('bescheid') || nameLower.includes('finanzamt') || nameLower.includes('steuer')) {
          autoCategory = 'bescheide';
        }

        newItems.push({
          id: `upload-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          file,
          title: titleWithoutExt,
          category: autoCategory,
          folderId: initialFolderId,
          date: today,
          dataUrl,
          fileSize: file.size,
          fileType: file.type || getFallbackMimeType(file.name),
          tags: [],
          notes: ''
        });
      } catch (err) {
        console.error('Error reading file:', err);
      }
    }

    if (newItems.length > 0) {
      setQueue(prev => [...prev, ...newItems]);
      if (queue.length === 0) {
        setActiveIdx(0);
      }
    }
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const getFallbackMimeType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'png') return 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (ext === 'txt') return 'text/plain';
    if (ext === 'csv') return 'text/csv';
    return 'application/octet-stream';
  };

  const removeItem = (index: number) => {
    const updated = queue.filter((_, idx) => idx !== index);
    setQueue(updated);
    if (activeIdx >= updated.length) {
      setActiveIdx(Math.max(0, updated.length - 1));
    }
  };

  const updateActiveItem = (field: keyof UploadQueueItem, value: any) => {
    if (!queue[activeIdx]) return;
    setQueue(prev => {
      const copy = [...prev];
      copy[activeIdx] = { ...copy[activeIdx], [field]: value };
      return copy;
    });
  };

  const addTag = (tagText: string) => {
    const trimmed = tagText.trim();
    if (!trimmed || !queue[activeIdx]) return;
    const currentTags = queue[activeIdx].tags || [];
    if (!currentTags.includes(trimmed)) {
      updateActiveItem('tags', [...currentTags, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    if (!queue[activeIdx]) return;
    const currentTags = queue[activeIdx].tags || [];
    updateActiveItem('tags', currentTags.filter(t => t !== tagToRemove));
  };

  const handleSaveAll = async () => {
    if (queue.length === 0) {
      setErrorMsg('Bitte wählen Sie mindestens eine Datei aus.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);

      const docsToSave: ClubDocument[] = queue.map(item => ({
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        title: item.title || item.file.name,
        fileName: item.file.name,
        fileType: item.fileType,
        fileSize: item.fileSize,
        dataUrl: item.dataUrl,
        category: item.category,
        folderId: item.folderId || undefined,
        date: item.date || new Date().toISOString().split('T')[0],
        uploadDate: new Date().toISOString(),
        tags: item.tags,
        notes: item.notes || undefined,
        memberId: item.memberId || undefined,
        memberName: item.memberName || undefined,
        transactionId: item.transactionId || undefined,
        transactionDocNumber: item.transactionDocNumber || undefined,
        isReceipt: item.category === 'belege',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      if (onSaveDocuments) {
        await onSaveDocuments(docsToSave);
      } else if (onSave) {
        await onSave(docsToSave);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Fehler beim Speichern der Dokumente.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentItem = queue[activeIdx];

  const formatSize = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div id="document-upload-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 md:p-6 animate-in fade-in duration-150">
      <div id="document-upload-modal-container" className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">
                Dokumente hochladen & archivieren
              </h3>
              <p className="text-xs text-slate-500">
                GoBD-konforme Ablage im Vereinsarchiv mit automatischer Formatunterstützung (PDF, Office, Bilder)
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Drag & Drop Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-blue-500 bg-blue-50/70 scale-[0.99]'
                : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => {
                if (e.target.files) handleFiles(e.target.files);
              }}
            />
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-1">
              Dateien per Drag & Drop hierher ziehen oder <span className="text-blue-600 underline">durchsuchen</span>
            </p>
            <p className="text-xs text-slate-500">
              Unterstützt PDF, Word (DOCX), Excel (XLSX), Bilder (PNG, JPG), CSV, Text und mehr. Mehrfachauswahl möglich.
            </p>
          </div>

          {/* Upload Queue list & Metadata Editor */}
          {queue.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
              {/* Queue sidebar */}
              <div className="md:col-span-5 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col">
                <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Ausgewählte Dateien ({queue.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Weitere hinzufügen
                  </button>
                </div>

                <div className="divide-y divide-slate-200 max-h-80 overflow-y-auto">
                  {queue.map((item, idx) => {
                    const isSelected = idx === activeIdx;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setActiveIdx(idx)}
                        className={`p-3 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                          isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-800 truncate" title={item.file.name}>
                              {item.title || item.file.name}
                            </p>
                            <span className="text-[10px] text-slate-500">
                              {formatSize(item.fileSize)} • {CATEGORY_CONFIG[item.category]?.label}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem(idx);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-200 rounded-md transition-colors"
                          title="Entfernen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detail Editor for Selected Item */}
              {currentItem && (
                <div className="md:col-span-7 border border-slate-200 rounded-xl p-4 bg-white space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-900">
                      Metadaten: {currentItem.file.name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {formatSize(currentItem.fileSize)}
                    </span>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Dokumententitel *
                    </label>
                    <input
                      type="text"
                      value={currentItem.title}
                      onChange={e => updateActiveItem('title', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="z.B. Mietvertrag Vereinsheim 2025"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Category */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Kategorie *
                      </label>
                      <select
                        value={currentItem.category}
                        onChange={e => updateActiveItem('category', e.target.value as DocumentCategory)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="belege">🧾 Buchhaltungsbelege</option>
                        <option value="vertraege">📜 Verträge & Vereinbarungen</option>
                        <option value="satzung">⚖️ Satzung & Ordnungen</option>
                        <option value="protokolle">📝 Protokolle & Versammlungen</option>
                        <option value="mitglieder">👥 Mitglieder & Anträge</option>
                        <option value="bescheide">🏛️ Finanzamt & Bescheide</option>
                        <option value="sonstiges">📂 Sonstige Dokumente</option>
                      </select>
                    </div>

                    {/* Folder / Subfolder */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                        <Folder className="w-3 h-3 text-slate-500" />
                        <span>Ordner / Unterordner</span>
                      </label>
                      <select
                        value={currentItem.folderId || ''}
                        onChange={e => {
                          const fId = e.target.value || null;
                          updateActiveItem('folderId', fId);
                          const chosenFolder = folders.find(f => f.id === fId);
                          if (chosenFolder?.category && chosenFolder.category !== 'all') {
                            updateActiveItem('category', chosenFolder.category);
                          }
                        }}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="">📁 Hauptverzeichnis (Kein Unterordner)</option>
                        {folders.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.parentId ? `— 📂 ${f.name}` : `📁 ${f.name}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Date */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Dokumentendatum
                      </label>
                      <input
                        type="date"
                        value={currentItem.date}
                        onChange={e => updateActiveItem('date', e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Verknüpfung zu Mitglied oder Buchung (Optional) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Member Link */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Mitglied verknüpfen (optional)
                      </label>
                      <select
                        value={currentItem.memberId || ''}
                        onChange={e => {
                          const mId = e.target.value;
                          const found = members.find(m => m.id === mId);
                          updateActiveItem('memberId', mId || undefined);
                          updateActiveItem('memberName', found ? `${found.firstName} ${found.lastName}` : undefined);
                        }}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- Kein Mitglied --</option>
                        {members.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.memberNumber} - {m.firstName} {m.lastName} ({m.department})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Transaction Link */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Buchung verknüpfen (optional)
                      </label>
                      <select
                        value={currentItem.transactionId || ''}
                        onChange={e => {
                          const tId = e.target.value;
                          const found = transactions.find(t => t.id === tId);
                          updateActiveItem('transactionId', tId || undefined);
                          updateActiveItem('transactionDocNumber', found ? found.documentNumber : undefined);
                        }}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- Keine Buchung --</option>
                        {transactions.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.documentNumber} - {t.partner} ({t.amount.toFixed(2)} €)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Schlagworte / Tags
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag(tagInput);
                          }
                        }}
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Tag eingeben und Enter drücken (z.B. Vorstand, Pacht, Spende)"
                      />
                      <button
                        type="button"
                        onClick={() => addTag(tagInput)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                      >
                        Hinzufügen
                      </button>
                    </div>
                    {currentItem.tags && currentItem.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {currentItem.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px]"
                          >
                            #{t}
                            <button
                              type="button"
                              onClick={() => removeTag(t)}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Bemerkung / Notiz (optional)
                    </label>
                    <textarea
                      rows={2}
                      value={currentItem.notes}
                      onChange={e => updateActiveItem('notes', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      placeholder="Zusätzliche Informationen zu diesem Dokument..."
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {queue.length > 0 ? `${queue.length} Dokument(e) bereit zur Archivierung` : 'Keine Dateien ausgewählt'}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Abbrechen
            </button>
            <button
              id="btn-confirm-upload-docs"
              type="button"
              disabled={queue.length === 0 || isSaving}
              onClick={handleSaveAll}
              className="px-5 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <span>Wird archiviert...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{queue.length > 1 ? `${queue.length} Dokumente archivieren` : 'Dokument archivieren'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
