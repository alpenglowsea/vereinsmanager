import React, { useState } from 'react';
import { MemberSurvey, SurveyQuestion, SurveyQuestionType, ClubSettings } from '../types';
import { SURVEY_PRESETS } from '../data/initialSurveys';
import {
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  Sparkles,
  Star,
  CheckSquare,
  List,
  Sliders,
  FileText,
  ToggleRight,
  Save,
  Layers,
  AlertCircle
} from 'lucide-react';

interface SurveyBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  survey: MemberSurvey | null;
  onSave: (survey: MemberSurvey) => Promise<void>;
  settings: ClubSettings;
}

export const SurveyBuilderModal: React.FC<SurveyBuilderModalProps> = ({
  isOpen,
  onClose,
  survey: initialSurvey,
  onSave,
  settings
}) => {
  const [formData, setFormData] = useState<MemberSurvey>(() => {
    if (initialSurvey) {
      return JSON.parse(JSON.stringify(initialSurvey));
    }
    return {
      id: `survey_${Date.now()}`,
      title: '',
      description: '',
      category: 'Mitgliederzufriedenheit',
      department: 'all',
      status: 'active',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      anonymous: true,
      useTokens: true,
      questions: [
        {
          id: `q_${Date.now()}_1`,
          title: 'Wie zufrieden sind Sie insgesamt mit unserem Verein?',
          description: 'Bitte vergeben Sie eine Gesamtnote von 1 bis 5 Sternen.',
          type: 'rating_stars',
          required: true,
          minRating: 1,
          maxRating: 5,
          order: 0
        },
        {
          id: `q_${Date.now()}_2`,
          title: 'Was gefällt Ihnen besonders gut oder was können wir verbessern?',
          type: 'text',
          required: false,
          order: 1
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

  const [activeTab, setActiveTab] = useState<'general' | 'questions'>('questions');
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (presetIndex: number) => {
    const preset = SURVEY_PRESETS[presetIndex];
    if (!preset) return;

    if (formData.questions.length > 0) {
      if (!confirm(`Möchten Sie die Vorlage "${preset.title}" laden? Bestehende Fragen werden dabei ersetzt.`)) {
        return;
      }
    }

    setFormData(prev => ({
      ...prev,
      title: preset.title,
      category: preset.category,
      description: preset.description,
      questions: preset.questions.map((q, idx) => ({
        ...q,
        id: `q_${Date.now()}_${idx}`
      }))
    }));
  };

  const handleAddQuestion = (type: SurveyQuestionType) => {
    const newQ: SurveyQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: type === 'rating_stars'
        ? 'Wie bewerten Sie diesen Punkt?'
        : type === 'scale_10'
        ? 'Wie wahrscheinlich ist es, dass Sie unseren Verein weiterempfehlen?'
        : type === 'yes_no'
        ? 'Stimmen Sie folgendem Vorschlag zu?'
        : type === 'text'
        ? 'Ihre Rückmeldung oder Ergänzungen:'
        : 'Bitte wählen Sie eine Option:',
      type,
      required: true,
      order: formData.questions.length,
      options: (type === 'single_choice' || type === 'multiple_choice')
        ? ['Option 1', 'Option 2', 'Option 3']
        : undefined,
      minRating: type === 'rating_stars' ? 1 : undefined,
      maxRating: type === 'rating_stars' ? 5 : undefined,
      scaleMin: type === 'scale_10' ? 0 : undefined,
      scaleMax: type === 'scale_10' ? 10 : undefined,
      scaleMinLabel: type === 'scale_10' ? '0 = Gar nicht' : undefined,
      scaleMaxLabel: type === 'scale_10' ? '10 = Voll und ganz' : undefined
    };

    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, newQ]
    }));
  };

  const handleUpdateQuestion = (index: number, updates: Partial<SurveyQuestion>) => {
    setFormData(prev => {
      const copy = [...prev.questions];
      copy[index] = { ...copy[index], ...updates };
      return { ...prev, questions: copy };
    });
  };

  const handleDeleteQuestion = (index: number) => {
    setFormData(prev => {
      const copy = prev.questions.filter((_, i) => i !== index);
      return {
        ...prev,
        questions: copy.map((q, i) => ({ ...q, order: i }))
      };
    });
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    setFormData(prev => {
      const copy = [...prev.questions];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;

      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;

      return {
        ...prev,
        questions: copy.map((q, i) => ({ ...q, order: i }))
      };
    });
  };

  const handleDuplicateQuestion = (index: number) => {
    setFormData(prev => {
      const q = prev.questions[index];
      const newQ: SurveyQuestion = {
        ...JSON.parse(JSON.stringify(q)),
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: `${q.title} (Kopie)`
      };
      const copy = [...prev.questions];
      copy.splice(index + 1, 0, newQ);
      return {
        ...prev,
        questions: copy.map((item, i) => ({ ...item, order: i }))
      };
    });
  };

  const handleOptionChange = (qIndex: number, optIndex: number, val: string) => {
    setFormData(prev => {
      const q = prev.questions[qIndex];
      if (!q.options) return prev;
      const newOpts = [...q.options];
      newOpts[optIndex] = val;
      const copy = [...prev.questions];
      copy[qIndex] = { ...q, options: newOpts };
      return { ...prev, questions: copy };
    });
  };

  const handleAddOption = (qIndex: number) => {
    setFormData(prev => {
      const q = prev.questions[qIndex];
      const newOpts = [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`];
      const copy = [...prev.questions];
      copy[qIndex] = { ...q, options: newOpts };
      return { ...prev, questions: copy };
    });
  };

  const handleRemoveOption = (qIndex: number, optIndex: number) => {
    setFormData(prev => {
      const q = prev.questions[qIndex];
      if (!q.options || q.options.length <= 1) return prev;
      const newOpts = q.options.filter((_, i) => i !== optIndex);
      const copy = [...prev.questions];
      copy[qIndex] = { ...q, options: newOpts };
      return { ...prev, questions: copy };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setValidationError('Bitte geben Sie einen Titel für die Befragung an.');
      setActiveTab('general');
      return;
    }
    if (formData.questions.length === 0) {
      setValidationError('Die Befragung muss mindestens eine Frage enthalten.');
      setActiveTab('questions');
      return;
    }

    try {
      setSaving(true);
      setValidationError(null);
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error('Fehler beim Speichern der Umfrage:', err);
      setValidationError('Fehler beim Speichern der Umfrage.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col border border-slate-200 dark:border-slate-800 max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 text-blue-400 rounded-xl border border-blue-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                {initialSurvey ? 'Befragung bearbeiten' : 'Neue Mitgliederbefragung erstellen'}
              </h3>
              <p className="text-xs text-slate-400">
                Fragebogen-Builder & Konfiguration für Vereinsbefragungen
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 dark:bg-slate-800/80 px-6 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('questions')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'questions'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Fragen & Fragebogen ({formData.questions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Einstellungen & Zeitraum
            </button>
          </div>

          {/* Preset Selector Dropdown */}
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              Vorlage laden:
            </span>
            <select
              onChange={(e) => {
                if (e.target.value !== '') {
                  handleApplyPreset(Number(e.target.value));
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="text-xs py-1 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium focus:outline-hidden"
            >
              <option value="" disabled>
                Vorgefertigtes Set wählen...
              </option>
              {SURVEY_PRESETS.map((p, idx) => (
                <option key={idx} value={idx}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-6">
          {validationError && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* TAB 1: QUESTIONS BUILDER */}
          {activeTab === 'questions' && (
            <div className="space-y-6">
              {/* Question Add Toolbar */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2.5">
                  Fragetyp hinzufügen:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddQuestion('rating_stars')}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    <span>Sterne-Bewertung (1–5)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddQuestion('scale_10')}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                  >
                    <Sliders className="w-3.5 h-3.5 text-blue-500" />
                    <span>NPS Skala (0–10)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddQuestion('single_choice')}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                  >
                    <List className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Einzelauswahl (Radio)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddQuestion('multiple_choice')}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Mehrfachauswahl</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddQuestion('yes_no')}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                  >
                    <ToggleRight className="w-3.5 h-3.5 text-teal-500" />
                    <span>Ja / Nein / Enthaltung</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddQuestion('text')}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                  >
                    <FileText className="w-3.5 h-3.5 text-purple-500" />
                    <span>Offener Freitext</span>
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {formData.questions.map((q, qIndex) => (
                  <div
                    key={q.id}
                    className="p-5 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4"
                  >
                    {/* Top row: Question index & Action controls */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-xl bg-blue-600/15 text-blue-600 dark:text-blue-400 font-bold font-mono text-xs flex items-center justify-center">
                          {qIndex + 1}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {q.type === 'rating_stars' && 'Sterne-Bewertung'}
                          {q.type === 'scale_10' && '0–10 NPS-Skala'}
                          {q.type === 'single_choice' && 'Einzelauswahl'}
                          {q.type === 'multiple_choice' && 'Mehrfachauswahl'}
                          {q.type === 'yes_no' && 'Ja / Nein / Enthaltung'}
                          {q.type === 'text' && 'Offenes Freitextfeld'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Move Up */}
                        <button
                          type="button"
                          onClick={() => handleMoveQuestion(qIndex, 'up')}
                          disabled={qIndex === 0}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                          title="Nach oben verschieben"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>

                        {/* Move Down */}
                        <button
                          type="button"
                          onClick={() => handleMoveQuestion(qIndex, 'down')}
                          disabled={qIndex === formData.questions.length - 1}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                          title="Nach unten verschieben"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>

                        {/* Duplicate */}
                        <button
                          type="button"
                          onClick={() => handleDuplicateQuestion(qIndex)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                          title="Frage duplizieren"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(qIndex)}
                          className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Frage entfernen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Question Title & Description Inputs */}
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={q.title}
                        onChange={(e) => handleUpdateQuestion(qIndex, { title: e.target.value })}
                        placeholder="Fragestellung eingeben..."
                        className="w-full px-3.5 py-2 text-sm font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={q.description || ''}
                        onChange={(e) => handleUpdateQuestion(qIndex, { description: e.target.value })}
                        placeholder="Optionale Erläuterung oder Hilfetext zur Frage..."
                        className="w-full px-3.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 focus:outline-hidden"
                      />
                    </div>

                    {/* Options Editor for single/multiple choice */}
                    {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                      <div className="space-y-2 pt-1 pl-2">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          Antwortoptionen:
                        </label>
                        {(q.options || []).map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <span className="w-5 text-center text-xs font-bold text-slate-400">
                              {optIdx + 1}.
                            </span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => handleOptionChange(qIndex, optIdx, e.target.value)}
                              className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(qIndex, optIdx)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                              title="Option entfernen"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleAddOption(qIndex)}
                          className="mt-1 px-3 py-1 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Option hinzufügen</span>
                        </button>
                      </div>
                    )}

                    {/* Scale labels for scale_10 */}
                    {q.type === 'scale_10' && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                            Beschriftung Minimum (0):
                          </label>
                          <input
                            type="text"
                            value={q.scaleMinLabel || ''}
                            onChange={(e) => handleUpdateQuestion(qIndex, { scaleMinLabel: e.target.value })}
                            placeholder="z.B. Gar nicht wahrscheinlich"
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                            Beschriftung Maximum (10):
                          </label>
                          <input
                            type="text"
                            value={q.scaleMaxLabel || ''}
                            onChange={(e) => handleUpdateQuestion(qIndex, { scaleMaxLabel: e.target.value })}
                            placeholder="z.B. Äußerst wahrscheinlich"
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                          />
                        </div>
                      </div>
                    )}

                    {/* Question Footer: Required toggle */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => handleUpdateQuestion(qIndex, { required: e.target.checked })}
                          className="w-4 h-4 rounded-md text-blue-600 focus:ring-blue-500 border-slate-300"
                        />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Pflichtfrage (Beantwortung zwingend erforderlich)
                        </span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: GENERAL SETTINGS & METADATA */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Titel der Befragung *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="z.B. Große Mitgliederbefragung 2026: Vereinsleben & Sportangebot"
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Einleitungstext & Beschreibung für die Mitglieder
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Liebe Vereinsmitglieder, Ihre Meinung ist uns wichtig! Diese Befragung dauert ca. 3 Minuten..."
                    className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 resize-y"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Themen-Kategorie
                  </label>
                  <input
                    type="text"
                    value={formData.category || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="z.B. Mitgliederzufriedenheit, Sportangebot, Vereinsheim"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Zielgruppe / Sparte
                  </label>
                  <select
                    value={formData.department || 'all'}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                  >
                    <option value="all">Gesamter Verein (Alle Sparten)</option>
                    {settings.departments?.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Startdatum
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Enddatum (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.endDate || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                  >
                    <option value="active">Aktiv (Teilnahme möglich)</option>
                    <option value="draft">Entwurf (Nur intern sichtbar)</option>
                    <option value="closed">Geschlossen (Beendet)</option>
                  </select>
                </div>
              </div>

              {/* Switches Box */}
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Teilnahme- & Sicherheitsregeln:
                </h4>

                {/* Switch 1: useTokens */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-800 dark:text-white block">
                      Einmal-Token je Mitglied verwenden (Empfohlen)
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Erstellt für jedes Mitglied einen persönlichen Einladungslink. Sobald abgestimmt wurde, verfällt der Link und verhindert Mehrfachabstimmungen.
                      Für weniger wichtige Umfragen kann der Switch deaktiviert werden, um einen allgemeinen Link zu nutzen.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, useTokens: !prev.useTokens }))}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 mt-0.5 ${
                      formData.useTokens ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${
                        formData.useTokens ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Switch 2: anonymous */}
                <div className="flex items-start justify-between gap-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="text-xs font-bold text-slate-800 dark:text-white block">
                      Anonyme Auswertung (DSGVO-konform)
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Antworten werden ohne Namen oder Mitgliedsnummer gespeichert. Selbst bei Verwendung von Einmal-Tokens wird die Stimmabgabe vom Mitgliedsprofil getrennt.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, anonymous: !prev.anonymous }))}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 mt-0.5 ${
                      formData.anonymous ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${
                        formData.anonymous ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer Save Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {formData.questions.length} Frage(n) konfiguriert
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                Abbrechen
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Wird gespeichert...' : 'Befragung speichern'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
