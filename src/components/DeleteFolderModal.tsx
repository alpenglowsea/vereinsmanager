import React, { useState } from 'react';
import { DocumentFolder, ClubDocument } from '../types';
import {
  AlertTriangle,
  X,
  Trash2,
  Folder
} from 'lucide-react';

interface DeleteFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (folderId: string) => Promise<void>;
  folder: DocumentFolder | null;
  allFolders: DocumentFolder[];
  documents: ClubDocument[];
}

export const DeleteFolderModal: React.FC<DeleteFolderModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  folder,
  allFolders,
  documents
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !folder) return null;

  // Calculate descendant folders & documents affected
  const getDescendants = (rootId: string) => {
    const ids = new Set<string>([rootId]);
    let added = true;
    while (added) {
      added = false;
      for (const f of allFolders) {
        if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
          ids.add(f.id);
          added = true;
        }
      }
    }
    return ids;
  };

  const affectedFolderIds = getDescendants(folder.id);
  const subfolderCount = affectedFolderIds.size - 1;
  const docCount = documents.filter(d => d.folderId && affectedFolderIds.has(d.folderId)).length;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onConfirm(folder.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div id="delete-folder-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 md:p-6 animate-in fade-in duration-150">
      <div id="delete-folder-modal-container" className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        <div className="p-6">
          <div className="flex items-center gap-3.5 mb-4">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Ordner „{folder.name}“ löschen?
              </h3>
              <p className="text-xs text-slate-500">
                Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 bg-slate-50 rounded-xl p-3.5 text-xs text-slate-600 border border-slate-200/80 mb-5">
            {subfolderCount > 0 && (
              <p className="font-semibold text-rose-600">
                ⚠️ Dieser Ordner enthält {subfolderCount} Unterordner, die ebenfalls entfernt werden.
              </p>
            )}
            <p>
              Enthaltene Dokumente ({docCount} Dateien) werden <strong className="text-slate-900">nicht gelöscht</strong>, sondern sicher in das Hauptverzeichnis / die übergeordnete Ansicht verschoben.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Abbrechen
            </button>
            <button
              id="btn-confirm-delete-folder"
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className="inline-flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isDeleting ? 'Wird gelöscht...' : 'Ordner unwiderruflich löschen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
