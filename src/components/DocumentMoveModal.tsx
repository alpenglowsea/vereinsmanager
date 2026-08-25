import React, { useState } from 'react';
import { DocumentCategory } from '../types';
import { FolderInput, X, Check } from 'lucide-react';
import { CATEGORY_CONFIG } from './DocumentViewerModal';

interface DocumentMoveModalProps {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onConfirm: (targetCategory: DocumentCategory) => Promise<void>;
}

export const DocumentMoveModal: React.FC<DocumentMoveModalProps> = ({
  isOpen,
  selectedCount,
  onClose,
  onConfirm
}) => {
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('belege');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm(selectedCategory);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories: { id: DocumentCategory; label: string; desc: string; icon: string }[] = [
    { id: 'belege', label: 'Buchhaltungsbelege', desc: 'Rechnungen, Quittungen, Spendenbelege, Kontoauszüge', icon: '🧾' },
    { id: 'vertraege', label: 'Verträge & Vereinbarungen', desc: 'Pacht-, Miet-, Trainer- & Sponsoringverträge', icon: '📜' },
    { id: 'satzung', label: 'Satzung & Ordnungen', desc: 'Vereinssatzung, Beitrags-, Geschäfts- & Ehrenordnung', icon: '⚖️' },
    { id: 'protokolle', label: 'Protokolle & Versammlungen', desc: 'Jahreshauptversammlung, Vorstandssitzungen', icon: '📝' },
    { id: 'mitglieder', label: 'Mitglieder & Anträge', desc: 'Aufnahmeanträge, Kündigungen, SEPA-Mandate', icon: '👥' },
    { id: 'bescheide', label: 'Finanzamt & Bescheide', desc: 'Freistellungsbescheide, Gemeinnützigkeitsnachweise', icon: '🏛️' },
    { id: 'sonstiges', label: 'Sonstige Dokumente', desc: 'Flyer, Urkunden, Presseberichte, Schadensmeldungen', icon: '📂' }
  ];

  return (
    <div id="document-move-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div id="document-move-modal-container" className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <FolderInput className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">In Kategorie verschieben</h3>
              <p className="text-xs text-slate-500">{selectedCount} Dokument(e) ausgewählt</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Categories List */}
        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
          {categories.map(cat => {
            const isSelected = selectedCategory === cat.id;
            return (
              <div
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-600'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-lg leading-none mt-0.5">{cat.icon}</span>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900">{cat.label}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{cat.desc}</p>
                  </div>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-xl transition-colors font-medium"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-xs transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Wird verschoben...' : 'Jetzt verschieben'}
          </button>
        </div>
      </div>
    </div>
  );
};
