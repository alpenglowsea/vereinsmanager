import React, { useState, useEffect } from 'react';
import { MemberSurvey, SurveyQuestion, MemberSurveyToken, MemberSurveyResponse, ClubSettings } from '../types';
import { StorageService } from '../services/storage';
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Star,
  Send,
  Lock,
  Calendar,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Check,
  X
} from 'lucide-react';

interface PublicSurveyViewProps {
  surveyId: string;
  token?: string;
  settings: ClubSettings;
  onClose?: () => void;
  isPreview?: boolean;
}

export const PublicSurveyView: React.FC<PublicSurveyViewProps> = ({
  surveyId,
  token: rawToken,
  settings,
  onClose,
  isPreview = false
}) => {
  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState<MemberSurvey | null>(null);
  const [surveyToken, setSurveyToken] = useState<MemberSurveyToken | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tokenBlockedReason, setTokenBlockedReason] = useState<string | null>(null);

  useEffect(() => {
    loadSurveyData();
  }, [surveyId, rawToken]);

  const loadSurveyData = async () => {
    try {
      setLoading(true);
      const s = await StorageService.getSurvey(surveyId);
      if (!s) {
        setTokenBlockedReason('Die angeforderte Befragung wurde nicht gefunden oder existiert nicht mehr.');
        setLoading(false);
        return;
      }
      setSurvey(s);

      // Check survey status & deadline
      if (s.status === 'closed') {
        setTokenBlockedReason('Diese Befragung wurde offiziell beendet. Eine Teilnahme ist leider nicht mehr möglich.');
        setLoading(false);
        return;
      }
      if (s.endDate) {
        const end = new Date(s.endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date() > end) {
          setTokenBlockedReason('Die Teilnahmefrist für diese Befragung ist abgelaufen. Vielen Dank für Ihr Interesse!');
          setLoading(false);
          return;
        }
      }

      // If tokens are required
      if (s.useTokens) {
        if (!rawToken) {
          if (!isPreview) {
            setTokenBlockedReason('Für diese Befragung ist ein persönlicher Einladungslink mit Einmal-Token erforderlich. Bitte verwenden Sie den Link aus Ihrer Einladung.');
            setLoading(false);
            return;
          }
        } else {
          const t = await StorageService.getSurveyToken(surveyId, rawToken);
          if (!t) {
            if (!isPreview) {
              setTokenBlockedReason('Ungültiger oder abgelaufener Einladungslink. Bitte prüfen Sie die URL.');
              setLoading(false);
              return;
            }
          } else if (t.isUsed) {
            if (!isPreview) {
              setTokenBlockedReason('Sie haben bereits mit diesem Einladungslink an der Befragung teilgenommen. Um ein unverfälschtes Ergebnis zu gewährleisten, ist jeder Link nur einmal gültig.');
              setLoading(false);
              return;
            }
          }
          setSurveyToken(t);
        }
      }

      // Initial answers state
      const initial: Record<string, any> = {};
      s.questions.forEach(q => {
        if (q.type === 'multiple_choice') {
          initial[q.id] = [];
        } else {
          initial[q.id] = undefined;
        }
      });
      setAnswers(initial);
    } catch (e) {
      console.error('Fehler beim Laden der Umfrage:', e);
      setTokenBlockedReason('Es ist ein Fehler beim Laden der Befragung aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  const handleSingleChoice = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const handleMultipleChoice = (questionId: string, option: string) => {
    setAnswers(prev => {
      const currentList: string[] = Array.isArray(prev[questionId]) ? prev[questionId] : [];
      const updated = currentList.includes(option)
        ? currentList.filter(o => o !== option)
        : [...currentList, option];
      return { ...prev, [questionId]: updated };
    });
    if (errors[questionId]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const handleRating = (questionId: string, rating: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: rating }));
    if (errors[questionId]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const handleText = (questionId: string, text: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: text }));
    if (errors[questionId]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    if (!survey) return false;
    const newErrors: Record<string, string> = {};

    survey.questions.forEach(q => {
      if (q.required) {
        const val = answers[q.id];
        if (val === undefined || val === null || val === '') {
          newErrors[q.id] = 'Bitte beantworten Sie diese Pflichtfrage.';
        } else if (Array.isArray(val) && val.length === 0) {
          newErrors[q.id] = 'Bitte wählen Sie mindestens eine Option aus.';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey) return;

    if (!validate()) {
      // Scroll to first error
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey) {
        const el = document.getElementById(`q-card-${firstErrorKey}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    try {
      setSubmitting(true);

      const response: MemberSurveyResponse = {
        id: `resp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        surveyId: survey.id,
        token: rawToken || undefined,
        memberId: survey.anonymous ? undefined : (surveyToken?.memberId || undefined),
        memberName: survey.anonymous ? undefined : (surveyToken?.memberName || undefined),
        submittedAt: new Date().toISOString(),
        answers: { ...answers }
      };

      await StorageService.saveSurveyResponse(response);

      // If token used, mark as used
      if (survey.useTokens && rawToken) {
        await StorageService.markSurveyTokenUsed(survey.id, rawToken);
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Fehler beim Absenden der Antworten:', err);
      alert('Fehler beim Übermitteln der Antworten. Bitte versuchen Sie es erneut.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate completion progress
  const totalQuestions = survey?.questions.length || 0;
  const answeredCount = survey?.questions.filter(q => {
    const val = answers[q.id];
    if (Array.isArray(val)) return val.length > 0;
    return val !== undefined && val !== null && val !== '';
  }).length || 0;
  const progressPct = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 text-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-slate-700 space-y-4">
          <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-base font-bold">Befragung wird geladen...</h3>
          <p className="text-xs text-slate-400">Einen Moment bitte, wir rufen die Fragen für Sie ab.</p>
        </div>
      </div>
    );
  }

  if (tokenBlockedReason) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 text-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-slate-700 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold">Hinweis zur Teilnahme</h3>
          <p className="text-sm text-slate-300 leading-relaxed">{tokenBlockedReason}</p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Fenster schließen
            </button>
          )}
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 text-white rounded-3xl p-8 sm:p-10 max-w-lg w-full text-center shadow-2xl border border-slate-700 space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/50">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold">Vielen Dank für Ihre Teilnahme!</h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Ihre Antworten wurden erfolgreich übermittelt {survey?.anonymous ? 'und vollständig anonym gespeichert' : ''}.
              Sie leisten damit einen wertvollen Beitrag zur Weiterentwicklung unseres Vereins!
            </p>
          </div>

          <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-700 text-left space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>{settings.clubName}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {survey?.title}
            </p>
            <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-800">
              <span>Übermittelt am: {new Date().toLocaleString('de-DE')}</span>
              <span className="text-emerald-400 font-medium">Status: Erfasst</span>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Schließen
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!survey) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-3 sm:p-6 md:p-8 font-sans">
      {/* Top Header Card */}
      <div className="w-full max-w-3xl mb-6">
        {isPreview && (
          <div className="mb-4 bg-amber-500/20 border border-amber-500/40 text-amber-300 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Vorschau-Modus: Sie sehen die Befragung so, wie sie Mitgliedern am Smartphone oder PC angezeigt wird.</span>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 bg-amber-600/40 hover:bg-amber-600/60 rounded-lg text-white text-xs font-bold"
              >
                Vorschau beenden
              </button>
            )}
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Club Identity */}
          <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-800/80 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-sm">
                {settings.clubName ? settings.clubName.substring(0, 3).toUpperCase() : 'TSV'}
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {settings.clubName}
                </h3>
                <span className="text-[11px] text-slate-400">Offizielle Mitgliederbefragung</span>
              </div>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-3">
            {survey.title}
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-5 whitespace-pre-line">
            {survey.description}
          </p>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            {survey.anonymous ? (
              <div className="px-3 py-1 bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 rounded-xl flex items-center gap-1.5 font-semibold">
                <Lock className="w-3.5 h-3.5" />
                <span>Anonyme Auswertung</span>
              </div>
            ) : (
              <div className="px-3 py-1 bg-blue-950/60 text-blue-300 border border-blue-800/50 rounded-xl flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Namentliche Teilnahme</span>
              </div>
            )}

            {survey.endDate && (
              <div className="px-3 py-1 bg-slate-800 text-slate-300 rounded-xl flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Teilnahme bis: {new Date(survey.endDate).toLocaleDateString('de-DE')}</span>
              </div>
            )}

            {surveyToken?.memberName && (
              <div className="px-3 py-1 bg-slate-800 text-slate-300 rounded-xl font-medium">
                Eingeladen: <strong className="text-white">{surveyToken.memberName}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Progress Bar */}
      <div className="w-full max-w-3xl sticky top-3 z-30 mb-6 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-3 shadow-lg flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
            <span>Fortschritt</span>
            <span className="text-blue-400 font-mono font-bold">
              {answeredCount} von {totalQuestions} beantwortet ({progressPct}%)
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Questions Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-3xl space-y-5 pb-16">
        {survey.questions.map((q, index) => {
          const hasError = Boolean(errors[q.id]);
          const currentAnswer = answers[q.id];

          return (
            <div
              key={q.id}
              id={`q-card-${q.id}`}
              className={`bg-slate-900 border rounded-3xl p-5 sm:p-7 shadow-lg transition-all ${
                hasError
                  ? 'border-rose-500/80 ring-2 ring-rose-500/20'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-start gap-3.5 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-mono font-bold shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                    {q.title}{' '}
                    {q.required && <span className="text-rose-400" title="Pflichtfrage">*</span>}
                  </h3>
                  {q.description && (
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {q.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Question Inputs based on Type */}

              {/* 1. Rating Stars (1-5) */}
              {q.type === 'rating_stars' && (
                <div className="pt-2">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {[1, 2, 3, 4, 5].map(star => {
                      const isSelected = currentAnswer >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleRating(q.id, star)}
                          className={`p-2.5 sm:p-3.5 rounded-2xl transition-all cursor-pointer flex flex-col items-center gap-1 group ${
                            isSelected
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 scale-105'
                              : 'bg-slate-800/80 text-slate-500 hover:text-slate-300 hover:bg-slate-800 border border-slate-700'
                          }`}
                        >
                          <Star
                            className={`w-6 h-6 sm:w-8 sm:h-8 transition-transform group-hover:scale-110 ${
                              isSelected ? 'fill-amber-400 text-amber-400' : 'text-slate-500'
                            }`}
                          />
                          <span className="text-[10px] font-mono font-bold">{star}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between max-w-xs">
                    <span>1 = Sehr unzufrieden</span>
                    <span>5 = Sehr zufrieden</span>
                  </div>
                </div>
              )}

              {/* 2. Scale 0-10 */}
              {q.type === 'scale_10' && (
                <div className="pt-2 space-y-2">
                  <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5 sm:gap-2">
                    {Array.from({ length: 11 }, (_, i) => i).map(num => {
                      const isSelected = currentAnswer === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleRating(q.id, num)}
                          className={`py-3 px-1 rounded-xl text-xs sm:text-sm font-bold font-mono transition-all cursor-pointer flex items-center justify-center ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50 scale-105 ring-2 ring-blue-400'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                          }`}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
                    <span>{q.scaleMinLabel || '0 = Überhaupt nicht'}</span>
                    <span>{q.scaleMaxLabel || '10 = Voll und ganz'}</span>
                  </div>
                </div>
              )}

              {/* 3. Single Choice */}
              {q.type === 'single_choice' && (
                <div className="space-y-2 pt-1">
                  {(q.options || []).map(opt => {
                    const isSelected = currentAnswer === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSingleChoice(q.id, opt)}
                        className={`w-full text-left p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center justify-between gap-3 border ${
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500 text-white shadow-xs'
                            : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                        }`}
                      >
                        <span className="leading-snug">{opt}</span>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'border-blue-500 bg-blue-600 text-white'
                              : 'border-slate-600 bg-slate-900'
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 4. Multiple Choice */}
              {q.type === 'multiple_choice' && (
                <div className="space-y-2 pt-1">
                  {(q.options || []).map(opt => {
                    const isSelected = Array.isArray(currentAnswer) && currentAnswer.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleMultipleChoice(q.id, opt)}
                        className={`w-full text-left p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center justify-between gap-3 border ${
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500 text-white shadow-xs'
                            : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                        }`}
                      >
                        <span className="leading-snug">{opt}</span>
                        <div
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'border-blue-500 bg-blue-600 text-white'
                              : 'border-slate-600 bg-slate-900'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 5. Yes / No / Abstain */}
              {q.type === 'yes_no' && (
                <div className="grid grid-cols-3 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSingleChoice(q.id, 'yes')}
                    className={`py-3 px-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 border ${
                      currentAnswer === 'yes'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/50'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Ja</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSingleChoice(q.id, 'no')}
                    className={`py-3 px-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 border ${
                      currentAnswer === 'no'
                        ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950/50'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                    }`}
                  >
                    <X className="w-4 h-4" />
                    <span>Nein</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSingleChoice(q.id, 'abstain')}
                    className={`py-3 px-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 border ${
                      currentAnswer === 'abstain'
                        ? 'bg-slate-600 text-white border-slate-500 shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>Enthaltung</span>
                  </button>
                </div>
              )}

              {/* 6. Freitext */}
              {q.type === 'text' && (
                <div className="pt-2">
                  <textarea
                    rows={4}
                    value={currentAnswer || ''}
                    onChange={(e) => handleText(q.id, e.target.value)}
                    placeholder="Ihre Rückmeldung, Anregungen oder Wünsche hier eingeben..."
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-2xl p-3.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-y"
                  />
                </div>
              )}

              {/* Inline Error notice */}
              {hasError && (
                <div className="mt-3 flex items-center gap-1.5 text-rose-400 text-xs font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors[q.id]}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Form Submit Bar */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Ihre Daten werden sicher und verschlüsselt an den Verein übertragen.</span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-900/40 hover:shadow-blue-900/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Wird übermittelt...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Antworten jetzt verbindlich absenden</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
