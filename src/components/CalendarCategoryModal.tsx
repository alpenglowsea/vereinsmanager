import React, { useState } from 'react';
import {
  CalendarEventCategory
} from '../types';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Tag,
  Palette,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface CalendarCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CalendarEventCategory[];
  onSaveCategory: (cat: CalendarEventCategory) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}

const PRESET_COLORS = [
  '#ef4444', // Red / Rose
  '#f97316', // Orange
  '#f59e0b', // Amber / Yellow
  '#10b981', // Emerald / Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet / Purple
  '#ec4899', // Pink
  '#64748b'  // Slate / Gray
];

export const CalendarCategoryModal: React.FC<CalendarCategoryModalProps> = ({
  isOpen,
  onClose,
  categories,
  onSaveCategory,
  onDeleteCategory
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [color, setColor] = useState<string>('#3b82f6');
  const [description, setDescription] = useState<string>('');
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setEditingId(null);
    setName('');
    setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    setDescription('');
    setIsAddingNew(true);
    setError(null);
  };

  const handleStartEdit = (cat: CalendarEventCategory) => {
    setEditingId(cat.id);
    setName(cat.name);
    setColor(cat.color);
    setDescription(cat.description || '');
    setIsAddingNew(true);
    setError(null);
  };

  const handleCancelForm = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Bitte geben Sie einen Namen für die Terminart ein.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const catToSave: CalendarEventCategory = {
        id: editingId || `cat-custom-${Date.now()}`,
        name: name.trim(),
        color: color,
        badgeBg: 'bg-slate-100',
        badgeText: 'text-slate-800',
        badgeBorder: 'border-slate-300',
        description: description.trim() || undefined,
        isSystem: false
      };

      await onSaveCategory(catToSave);
      setIsAddingNew(false);
      setEditingId(null);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern der Kategorie.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (cat: CalendarEventCategory) => {
    if (cat.isSystem) {
      alert('Standard-Systemkategorien können nicht gelöscht werden.');
      return;
    }
    if (confirm(`Möchten Sie die Terminart "${cat.name}" wirklich löschen?`)) {
      await onDeleteCategory(cat.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Terminarten & Farbkennzeichnung</h3>
              <p className="text-xs text-slate-500">Kategorien für Veranstaltungen, Spiele und Termine verwalten</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Add / Edit Form */}
          {isAddingNew ? (
            <form onSubmit={handleSave} className="p-5 bg-slate-50 rounded-2xl border border-purple-200 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-purple-600" />
                  <span>{editingId ? 'Terminart bearbeiten' : 'Neue Terminart erstellen'}</span>
                </h4>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Abbrechen
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bezeichnung der Terminart *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z.B. Turniere & Pokalspiele, Schnuppertraining..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Farbe auswählen
                </label>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        color === c ? 'scale-115 border-slate-900 shadow-md ring-2 ring-purple-300' : 'border-white hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <div className="flex items-center gap-2 ml-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-white"
                      title="Eigene Farbe wählen"
                    />
                    <span className="text-xs font-mono text-slate-500">{color}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Beschreibung (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kurze Erklärung wofür diese Kategorie verwendet wird..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-hidden"
                />
              </div>

              {/* Preview Chip */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Vorschau im Kalender:</span>
                <span
                  className="px-3 py-1 rounded-lg text-xs font-bold text-white shadow-xs"
                  style={{ backgroundColor: color }}
                >
                  {name || 'Muster-Kategorie'}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-3.5 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 shadow-xs transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'Speichern...' : 'Kategorie speichern'}</span>
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={handleStartAdd}
              className="w-full py-3 border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/50 hover:bg-purple-50 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-purple-700 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Neue Terminart hinzufügen</span>
            </button>
          )}

          {/* List of existing categories */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Vorhandene Terminarten ({categories.length})
            </h4>
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span
                      className="w-4 h-4 rounded-full shrink-0 shadow-xs ring-2 ring-white"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{cat.name}</span>
                        {cat.isSystem && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                            <ShieldCheck className="w-3 h-3 text-slate-400" />
                            Standard
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-xs text-slate-500 line-clamp-1">{cat.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleStartEdit(cat)}
                      className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Bearbeiten"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!cat.isSystem && (
                      <button
                        onClick={() => handleDelete(cat)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 transition-colors shadow-xs"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
};
