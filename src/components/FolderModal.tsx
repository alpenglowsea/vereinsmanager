import React, { useState, useEffect } from 'react';
import { DocumentFolder, DocumentCategory } from '../types';
import {
  X,
  Folder,
  FolderPlus,
  Edit2,
  Tag,
  Palette,
  AlertCircle
} from 'lucide-react';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (folder: DocumentFolder) => Promise<void>;
  existingFolder?: DocumentFolder | null;
  defaultParentId?: string | null;
  defaultCategory?: DocumentCategory | 'all';
  allFolders: DocumentFolder[];
}

const COLOR_PRESETS = [
  { value: '#3b82f6', label: 'Blau', bg: 'bg-blue-500' },
  { value: '#10b981', label: 'Smaragdgrün', bg: 'bg-emerald-500' },
  { value: '#f59e0b', label: 'Bernstein / Gold', bg: 'bg-amber-500' },
  { value: '#8b5cf6', label: 'Violett', bg: 'bg-purple-500' },
  { value: '#ef4444', label: 'Rot', bg: 'bg-rose-500' },
  { value: '#06b6d4', label: 'Cyan / Türkis', bg: 'bg-cyan-500' },
  { value: '#ec4899', label: 'Pink', bg: 'bg-pink-500' },
  { value: '#6366f1', label: 'Indigo', bg: 'bg-indigo-500' },
  { value: '#64748b', label: 'Schiefergrau', bg: 'bg-slate-500' }
];

export const FolderModal: React.FC<FolderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingFolder,
  defaultParentId = null,
  defaultCategory = 'all',
  allFolders
}) => {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [category, setCategory] = useState<DocumentCategory | 'all'>('all');
  const [color, setColor] = useState('#3b82f6');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (existingFolder) {
      setName(existingFolder.name);
      setParentId(existingFolder.parentId || null);
      setCategory(existingFolder.category || 'all');
      setColor(existingFolder.color || '#3b82f6');
      setDescription(existingFolder.description || '');
    } else {
      setName('');
      setParentId(defaultParentId || null);
      setCategory(defaultCategory || 'all');
      setColor('#3b82f6');
      setDescription('');
    }
    setErrorMsg(null);
  }, [existingFolder, defaultParentId, defaultCategory, isOpen]);

  if (!isOpen) return null;

  // Prevent selecting self or descendant folders as parent (prevents cyclic trees)
  const getDescendantIds = (folderId: string): Set<string> => {
    const descendants = new Set<string>([folderId]);
    let added = true;
    while (added) {
      added = false;
      for (const f of allFolders) {
        if (f.parentId && descendants.has(f.parentId) && !descendants.has(f.id)) {
          descendants.add(f.id);
          added = true;
        }
      }
    }
    return descendants;
  };

  const forbiddenParentIds = existingFolder ? getDescendantIds(existingFolder.id) : new Set<string>();

  // Build folder hierarchy for dropdown
  const buildFolderOptions = () => {
    const options: { id: string | null; label: string; depth: number }[] = [
      { id: null, label: '📁 Hauptverzeichnis (Kein übergeordneter Ordner)', depth: 0 }
    ];

    const addChildren = (pId: string | null, depth: number) => {
      const children = allFolders.filter(f => (f.parentId || null) === pId && !forbiddenParentIds.has(f.id));
      for (const child of children) {
        const indent = '— '.repeat(depth);
        options.push({
          id: child.id,
          label: `${indent}📁 ${child.name}`,
          depth
        });
        addChildren(child.id, depth + 1);
      }
    };

    addChildren(null, 0);
    return options;
  };

  const folderOptions = buildFolderOptions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Bitte geben Sie einen Namen für den Ordner an.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);

      const folderToSave: DocumentFolder = {
        id: existingFolder?.id || `folder-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: name.trim(),
        parentId: parentId || null,
        category: category !== 'all' ? category : undefined,
        color: color || '#3b82f6',
        description: description.trim() || undefined,
        createdAt: existingFolder?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSave(folderToSave);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Fehler beim Speichern des Ordners.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="folder-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 md:p-6 animate-in fade-in duration-150">
      <div id="folder-modal-container" className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl text-white shadow-xs"
              style={{ backgroundColor: color }}
            >
              {existingFolder ? <Edit2 className="w-5 h-5" /> : <FolderPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                {existingFolder ? 'Ordner bearbeiten' : parentId ? 'Neuen Unterordner anlegen' : 'Neuen Ordner anlegen'}
              </h3>
              <p className="text-xs text-slate-500">
                {existingFolder ? 'Passen Sie Namen, Hierarchie oder Farbe an' : 'Strukturieren Sie Ihre Vereinsdokumente'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Folder Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ordnername <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="input-folder-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="z.B. Trainervereinbarungen 2026, Sommerfest, Kassenbelege"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
                required
              />
            </div>
          </div>

          {/* Parent Folder Hierarchy */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-slate-500" />
              <span>Übergeordneter Ordner (Hierarchie)</span>
            </label>
            <select
              id="select-folder-parent"
              value={parentId || ''}
              onChange={e => setParentId(e.target.value || null)}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {folderOptions.map((opt, idx) => (
                <option key={opt.id || `root-${idx}`} value={opt.id || ''}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Wählen Sie einen Ordner aus, um diesen als Unterordner einzubetten.
            </p>
          </div>

          {/* Color Palette */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-slate-500" />
              <span>Ordnerfarbe</span>
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map(c => {
                const isSelected = color.toLowerCase() === c.value.toLowerCase();
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`w-7 h-7 rounded-lg transition-transform flex items-center justify-center ${
                      isSelected ? 'ring-2 ring-slate-900 ring-offset-2 scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  >
                    {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Association */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-500" />
              <span>Standard-Kategorie (optional)</span>
            </label>
            <select
              id="select-folder-category"
              value={category}
              onChange={e => setCategory(e.target.value as DocumentCategory | 'all')}
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="all">📁 Keine feste Kategoriezuweisung</option>
              <option value="belege">🧾 Buchhaltungsbelege</option>
              <option value="vertraege">📜 Verträge & Vereinbarungen</option>
              <option value="satzung">⚖️ Satzung & Ordnungen</option>
              <option value="protokolle">📝 Protokolle & Versammlungen</option>
              <option value="mitglieder">👥 Mitglieder & Anträge</option>
              <option value="bescheide">🏛️ Finanzamt & Bescheide</option>
              <option value="sonstiges">📂 Sonstige Dokumente</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Beschreibung & Notiz (optional)
            </label>
            <textarea
              id="textarea-folder-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="z.B. Enthält alle Trainerhonorare und Tätigkeitsnachweise für das laufende Kalenderjahr..."
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Abbrechen
            </button>
            <button
              id="btn-save-folder"
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              {isSaving ? 'Wird gespeichert...' : existingFolder ? 'Änderungen speichern' : 'Ordner erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
