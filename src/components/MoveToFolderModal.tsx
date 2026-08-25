import React, { useState } from 'react';
import { ClubDocument, DocumentFolder, DocumentCategory } from '../types';
import {
  X,
  FolderInput,
  Folder,
  Check,
  Search,
  ChevronRight,
  ChevronDown,
  AlertCircle
} from 'lucide-react';

interface MoveToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMove: (docIds: string[], targetFolderId: string | null, targetCategory?: DocumentCategory) => Promise<void>;
  documentsToMove: ClubDocument[];
  allFolders: DocumentFolder[];
}

export const MoveToFolderModal: React.FC<MoveToFolderModalProps> = ({
  isOpen,
  onClose,
  onMove,
  documentsToMove,
  allFolders
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || documentsToMove.length === 0) return null;

  // Build hierarchical folder list
  const filteredFolders = allFolders.filter(f =>
    searchFilter ? f.name.toLowerCase().includes(searchFilter.toLowerCase()) : true
  );

  const getFolderHierarchy = () => {
    const list: { folder: DocumentFolder; depth: number }[] = [];
    const visited = new Set<string>();

    const append = (pId: string | null, depth: number) => {
      const children = allFolders.filter(f => (f.parentId || null) === pId && !visited.has(f.id));
      for (const child of children) {
        visited.add(child.id);
        list.push({ folder: child, depth });
        append(child.id, depth + 1);
      }
    };

    append(null, 0);

    // Any remaining unparented folders
    for (const f of allFolders) {
      if (!visited.has(f.id)) {
        list.push({ folder: f, depth: 0 });
      }
    }

    if (!searchFilter.trim()) return list;
    return list.filter(item => item.folder.name.toLowerCase().includes(searchFilter.toLowerCase()));
  };

  const hierarchy = getFolderHierarchy();

  const handleConfirmMove = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const targetFolder = allFolders.find(f => f.id === selectedFolderId);
      const targetCategory = targetFolder?.category && targetFolder.category !== 'all' ? targetFolder.category : undefined;

      const docIds = documentsToMove.map(d => d.id);
      await onMove(docIds, selectedFolderId, targetCategory);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Fehler beim Verschieben der Dokumente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="move-to-folder-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 md:p-6 animate-in fade-in duration-150">
      <div id="move-to-folder-modal-container" className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
              <FolderInput className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                In Ordner verschieben
              </h3>
              <p className="text-xs text-slate-500">
                {documentsToMove.length === 1
                  ? `„${documentsToMove[0].title}“ verschieben`
                  : `${documentsToMove.length} Dokumente verschieben`}
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

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Search Folder */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Zielordner suchen..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Folder Options List */}
          <div className="space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50/50 max-h-64 overflow-y-auto">
            {/* Root Option */}
            <button
              type="button"
              onClick={() => setSelectedFolderId(null)}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs transition-all ${
                selectedFolderId === null
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-700 hover:bg-white hover:shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">📁</span>
                <span>Hauptverzeichnis (Kein Unterordner)</span>
              </div>
              {selectedFolderId === null && <Check className="w-4 h-4 text-white" />}
            </button>

            {/* Tree Folders */}
            {hierarchy.map(({ folder, depth }) => {
              const isSelected = selectedFolderId === folder.id;
              const indentPadding = depth > 0 ? `${depth * 16}px` : '0px';

              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  style={{ paddingLeft: `calc(10px + ${indentPadding})` }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-all text-left ${
                    isSelected
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-700 hover:bg-white hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3.5 h-3.5 rounded-sm shrink-0"
                      style={{ backgroundColor: folder.color || '#3b82f6' }}
                    />
                    <span className="truncate">{folder.name}</span>
                    {folder.parentId && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-sm ${isSelected ? 'bg-blue-700 text-blue-200' : 'bg-slate-200 text-slate-600'}`}>
                        Unterordner
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-white shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500">
            Tipp: Beim Verschieben in einen Ordner mit zugewiesener Standardkategorie wird die Dokumentenkategorie bei Bedarf automatisch harmonisiert.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Abbrechen
          </button>
          <button
            id="btn-confirm-move-to-folder"
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirmMove}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            {isSubmitting ? 'Wird verschoben...' : 'Jetzt hierher verschieben'}
          </button>
        </div>
      </div>
    </div>
  );
};
