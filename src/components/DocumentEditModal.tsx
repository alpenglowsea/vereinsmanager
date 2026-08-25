import React, { useState } from 'react';
import { ClubDocument, DocumentCategory, DocumentFolder, Member, Transaction } from '../types';
import {
  X,
  FileText,
  Save,
  Tag,
  Folder,
  AlertCircle
} from 'lucide-react';

interface DocumentEditModalProps {
  document: ClubDocument | null;
  onClose: () => void;
  onSave: (updated: ClubDocument) => Promise<void>;
  members?: Member[];
  transactions?: Transaction[];
  folders?: DocumentFolder[];
}

export const DocumentEditModal: React.FC<DocumentEditModalProps> = ({
  document: doc,
  onClose,
  onSave,
  members = [],
  transactions = [],
  folders = []
}) => {
  if (!doc) return null;

  const [title, setTitle] = useState(doc.title);
  const [category, setCategory] = useState<DocumentCategory>(doc.category);
  const [folderId, setFolderId] = useState<string | null>(doc.folderId || null);
  const [date, setDate] = useState(doc.date || '');
  const [tags, setTags] = useState<string[]>(doc.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState(doc.notes || '');
  const [memberId, setMemberId] = useState(doc.memberId || '');
  const [transactionId, setTransactionId] = useState(doc.transactionId || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const addTag = (val: string) => {
    const t = val.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput('');
  };

  const removeTag = (t: string) => {
    setTags(tags.filter(item => item !== t));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Bitte geben Sie einen Dokumententitel an.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);

      const foundMember = members.find(m => m.id === memberId);
      const foundTx = transactions.find(t => t.id === transactionId);

      const updated: ClubDocument = {
        ...doc,
        title: title.trim(),
        category,
        folderId: folderId || undefined,
        date: date || new Date().toISOString().split('T')[0],
        tags,
        notes: notes.trim() || undefined,
        memberId: memberId || undefined,
        memberName: foundMember ? `${foundMember.firstName} ${foundMember.lastName}` : undefined,
        transactionId: transactionId || undefined,
        transactionDocNumber: foundTx ? foundTx.documentNumber : undefined,
        updatedAt: new Date().toISOString()
      };

      await onSave(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Fehler beim Aktualisieren des Dokuments.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="document-edit-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 md:p-6 animate-in fade-in duration-150">
      <div id="document-edit-modal-container" className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 text-white rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Metadaten bearbeiten</h3>
              <p className="text-xs text-slate-500 truncate max-w-xs">{doc.fileName}</p>
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

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Dokumententitel *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Category */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Kategorie *
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as DocumentCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
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
              <label className="block font-medium text-slate-700 mb-1 flex items-center gap-1">
                <Folder className="w-3 h-3 text-slate-500" />
                <span>Ordner</span>
              </label>
              <select
                value={folderId || ''}
                onChange={e => {
                  const fId = e.target.value || null;
                  setFolderId(fId);
                  const chosenFolder = folders.find(f => f.id === fId);
                  if (chosenFolder?.category && chosenFolder.category !== 'all') {
                    setCategory(chosenFolder.category);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs bg-white"
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

          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Dokumentendatum
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
              />
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Mitglied (optional)
              </label>
              <select
                value={memberId}
                onChange={e => setMemberId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
              >
                <option value="">-- Keine Verknüpfung --</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.memberNumber} - {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Buchung (optional)
              </label>
              <select
                value={transactionId}
                onChange={e => setTransactionId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
              >
                <option value="">-- Keine Verknüpfung --</option>
                {transactions.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.documentNumber} - {t.partner}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Schlagworte
            </label>
            <div className="flex gap-2 mb-1.5">
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
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                placeholder="Schlagwort eingeben..."
              />
              <button
                type="button"
                onClick={() => addTag(tagInput)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
              >
                +
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t, idx) => (
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
            <label className="block font-medium text-slate-700 mb-1">
              Notizen / Bemerkungen
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none text-xs"
              placeholder="Zusatzangaben zum Dokument..."
            />
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Speichern...' : 'Änderungen speichern'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
