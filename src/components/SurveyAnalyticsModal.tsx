import React, { useState, useEffect, useCallback } from 'react';
import { LoadingState } from './LoadingState';
import { MemberSurvey, MemberSurveyResponse, MemberSurveyToken, ClubSettings } from '../types';
import { StorageService } from '../services/storage';
import { SurveyPdfService } from '../services/surveyPdfService';
import {
  X,
  BarChart3,
  FileText,
  FileSpreadsheet,
  Star,
  Lock,
  ChevronDown,
  ChevronUp,
  TrendingUp
} from 'lucide-react';

interface SurveyAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  survey: MemberSurvey;
  settings: ClubSettings;
}

export const SurveyAnalyticsModal: React.FC<SurveyAnalyticsModalProps> = ({
  isOpen,
  onClose,
  survey,
  settings
}) => {
  const [responses, setResponses] = useState<MemberSurveyResponse[]>([]);
  const [tokens, setTokens] = useState<MemberSurveyToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'charts' | 'responses'>('charts');
  const [expandedResponseId, setExpandedResponseId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [respList, tokenList] = await Promise.all([
        StorageService.getSurveyResponses(survey.id),
        StorageService.getSurveyTokens(survey.id)
      ]);
      setResponses(respList);
      setTokens(tokenList);
    } catch (e) {
      console.warn('Fehler beim Laden der Auswertungsdaten:', e);
    } finally {
      setLoading(false);
    }
  }, [survey.id]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);


  const totalResponses = responses.length;
  const totalInvited = survey.useTokens && tokens.length > 0 ? tokens.length : totalResponses;
  const returnRate = totalInvited > 0 ? Math.round((totalResponses / totalInvited) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col border border-slate-200 dark:border-slate-800 max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/30 text-indigo-400 rounded-xl border border-indigo-500/30">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                Auswertung & Feedback-Analyse
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-md">
                {survey.title}
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

        {/* Subheader Toolbar & KPI row */}
        <div className="bg-slate-100 dark:bg-slate-800/80 px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700/80 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('charts')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'charts'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Diagramme & Kennzahlen
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('responses')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'responses'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Einzelantworten ({totalResponses})
            </button>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => SurveyPdfService.exportSurveyResultsPdf(survey, responses, tokens, settings)}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
              title="Vollständigen Bericht als PDF herunterladen"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>PDF-Bericht</span>
            </button>

            <button
              type="button"
              onClick={() => SurveyPdfService.exportSurveyResponsesCsv(survey, responses)}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
              title="Antwort-Rohdaten als CSV für Excel exportieren"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>CSV-Rohdaten</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Teilnahmen
              </span>
              <p className="text-2xl font-extrabold text-slate-800 dark:text-white mt-1">
                {totalResponses}
              </p>
              <span className="text-[10px] text-slate-400">Abgeschlossene Fragebögen</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Rücklaufquote
              </span>
              <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
                {returnRate} %
              </p>
              <span className="text-[10px] text-slate-400">
                {survey.useTokens ? `von ${totalInvited} Eingeladenen` : 'Ohne Beschränkung'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Datenschutz
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <Lock className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-bold text-slate-800 dark:text-white">
                  {survey.anonymous ? 'Anonym' : 'Personalisiert'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400">DSGVO-konforme Speicherung</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Zeitraum
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-white mt-1">
                {survey.startDate || '—'}
              </p>
              <span className="text-[10px] text-slate-400">
                bis {survey.endDate ? survey.endDate : 'offen'}
              </span>
            </div>
          </div>

          {loading && (
            <LoadingState label="Antworten werden ausgewertet …" />
          )}

          {/* TAB 1: CHARTS & METRICS */}
          {!loading && activeTab === 'charts' && (
            <div className="space-y-6">
              {totalResponses === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-3 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700">
                  <BarChart3 className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Bisher noch keine Antworten eingegangen
                  </h4>
                  <p className="text-xs max-w-md mx-auto">
                    Sobald Mitglieder über ihren Einladungslink abstimmen, erscheinen die Visualisierungen und Durchschnitte hier in Echtzeit.
                  </p>
                </div>
              ) : (
                survey.questions.map((q, qIndex) => {
                  const rawAnswers = responses
                    .map(r => r.answers[q.id])
                    .filter(val => val !== undefined && val !== null && val !== '');

                  return (
                    <div
                      key={q.id}
                      className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4"
                    >
                      {/* Question header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span className="w-7 h-7 rounded-xl bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 font-bold font-mono text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {qIndex + 1}
                          </span>
                          <div>
                            <h4 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white leading-snug">
                              {q.title}
                            </h4>
                            {q.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {q.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                          {rawAnswers.length} Antwort(en)
                        </span>
                      </div>

                      {/* Question Visualizer */}

                      {/* 1. Rating Stars (1-5) */}
                      {q.type === 'rating_stars' && (() => {
                        const numericAnswers = rawAnswers.map(a => Number(a)).filter(n => !isNaN(n) && n > 0);
                        const avg = numericAnswers.length > 0
                          ? (numericAnswers.reduce((a, b) => a + b, 0) / numericAnswers.length).toFixed(2)
                          : '0.0';

                        const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
                        numericAnswers.forEach(n => {
                          if (counts[n] !== undefined) counts[n]++;
                        });

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 pt-2 items-center">
                            <div className="sm:col-span-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1">
                              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                                Zufriedenheits-Wert
                              </span>
                              <div className="text-4xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                                {avg}
                              </div>
                              <div className="flex items-center justify-center gap-1 text-amber-500">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <Star
                                    key={s}
                                    className={`w-4 h-4 ${
                                      Number(avg) >= s ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-[10px] text-slate-400 block pt-1">
                                von maximal 5.0 Sternen
                              </span>
                            </div>

                            <div className="sm:col-span-8 space-y-2">
                              {[5, 4, 3, 2, 1].map(stars => {
                                const c = counts[stars] || 0;
                                const pct = numericAnswers.length > 0
                                  ? Math.round((c / numericAnswers.length) * 100)
                                  : 0;

                                return (
                                  <div key={stars} className="flex items-center gap-3 text-xs">
                                    <span className="w-14 font-semibold text-slate-600 dark:text-slate-300 shrink-0 flex items-center gap-1">
                                      <span>{stars}</span>
                                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    </span>
                                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                                      <div
                                        className="bg-amber-500 h-full rounded-full transition-all"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="w-16 text-right font-mono text-slate-500 dark:text-slate-400 shrink-0">
                                      {c} ({pct}%)
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 2. Scale 0-10 (NPS) */}
                      {q.type === 'scale_10' && (() => {
                        const numericAnswers = rawAnswers.map(a => Number(a)).filter(n => !isNaN(n) && n >= 0 && n <= 10);
                        const promoters = numericAnswers.filter(n => n >= 9).length;
                        const passives = numericAnswers.filter(n => n >= 7 && n <= 8).length;
                        const detractors = numericAnswers.filter(n => n <= 6).length;
                        const total = numericAnswers.length || 1;
                        const nps = Math.round(((promoters - detractors) / total) * 100);

                        return (
                          <div className="space-y-4 pt-2">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                                  Promotoren (9–10)
                                </span>
                                <p className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">
                                  {promoters} ({Math.round((promoters / total) * 100)}%)
                                </p>
                                <span className="text-[10px] text-slate-400">Begeisterte Weiterempfehler</span>
                              </div>

                              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase">
                                  Passive (7–8)
                                </span>
                                <p className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">
                                  {passives} ({Math.round((passives / total) * 100)}%)
                                </p>
                                <span className="text-[10px] text-slate-400">Zufrieden, aber wechselbereit</span>
                              </div>

                              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60">
                                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase">
                                  Detraktoren (0–6)
                                </span>
                                <p className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">
                                  {detractors} ({Math.round((detractors / total) * 100)}%)
                                </p>
                                <span className="text-[10px] text-slate-400">Kritiker / Unzufrieden</span>
                              </div>
                            </div>

                            {/* NPS score banner */}
                            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                <TrendingUp className="w-4 h-4 text-blue-500" />
                                <span>Net Promoter Score (NPS Index):</span>
                              </div>
                              <span className={`text-base font-extrabold font-mono px-3 py-0.5 rounded-lg ${
                                nps > 30
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : nps >= 0
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}>
                                {nps > 0 ? `+${nps}` : nps}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 3. Single Choice & Multiple Choice */}
                      {(q.type === 'single_choice' || q.type === 'multiple_choice') && (() => {
                        const counts: Record<string, number> = {};
                        (q.options || []).forEach(opt => { counts[opt] = 0; });

                        rawAnswers.forEach(ans => {
                          if (Array.isArray(ans)) {
                            ans.forEach(val => { counts[val] = (counts[val] || 0) + 1; });
                          } else {
                            counts[ans] = (counts[ans] || 0) + 1;
                          }
                        });

                        const totalAnswerRows = rawAnswers.length || 1;

                        return (
                          <div className="space-y-2.5 pt-2">
                            {(q.options || []).map(opt => {
                              const c = counts[opt] || 0;
                              const pct = Math.round((c / totalAnswerRows) * 100);

                              return (
                                <div key={opt} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                                    <span className="truncate pr-2">{opt}</span>
                                    <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">
                                      {c} Stimmen ({pct}%)
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                                    <div
                                      className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* 4. Yes / No */}
                      {q.type === 'yes_no' && (() => {
                        const yes = rawAnswers.filter(a => a === 'yes').length;
                        const no = rawAnswers.filter(a => a === 'no').length;
                        const abstain = rawAnswers.filter(a => a === 'abstain').length;
                        const total = rawAnswers.length || 1;

                        return (
                          <div className="grid grid-cols-3 gap-3 pt-2">
                            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-center">
                              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                                Ja
                              </span>
                              <p className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">
                                {yes} ({Math.round((yes / total) * 100)}%)
                              </p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-center">
                              <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase">
                                Nein
                              </span>
                              <p className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">
                                {no} ({Math.round((no / total) * 100)}%)
                              </p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                                Enthaltung
                              </span>
                              <p className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">
                                {abstain} ({Math.round((abstain / total) * 100)}%)
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 5. Freitext */}
                      {q.type === 'text' && (() => {
                        const textList = rawAnswers
                          .map(a => String(a).trim())
                          .filter(a => a.length > 0);

                        return (
                          <div className="space-y-3 pt-1">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>{textList.length} Freitext-Rückmeldungen eingegangen</span>
                            </div>

                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {textList.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">
                                  Noch keine Freitext-Antworten vorhanden.
                                </p>
                              ) : (
                                textList.map((txt, i) => (
                                  <div
                                    key={i}
                                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 leading-relaxed"
                                  >
                                    "{txt}"
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: INDIVIDUAL RESPONSES LOG */}
          {!loading && activeTab === 'responses' && (
            <div className="space-y-3">
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3.5">Teilnehmer</th>
                        <th className="py-2.5 px-3">Eingereicht am</th>
                        <th className="py-2.5 px-3">Antworten</th>
                        <th className="py-2.5 px-3 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {responses.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400">
                            Keine Antworten vorhanden.
                          </td>
                        </tr>
                      ) : (
                        responses.map((resp, idx) => {
                          const isExpanded = expandedResponseId === resp.id;
                          const answeredCount = Object.keys(resp.answers || {}).length;

                          return (
                            <React.Fragment key={resp.id}>
                              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="py-2.5 px-3.5 font-semibold text-slate-800 dark:text-white">
                                  {survey.anonymous
                                    ? `Anonyme Teilnahme #${responses.length - idx}`
                                    : (resp.memberName || 'Mitglied')}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-mono">
                                  {new Date(resp.submittedAt).toLocaleString('de-DE')}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-medium">
                                    {answeredCount} Frage(n) beantwortet
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedResponseId(isExpanded ? null : resp.id)}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 cursor-pointer"
                                  >
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded Row */}
                              {isExpanded && (
                                <tr className="bg-slate-50/70 dark:bg-slate-850">
                                  <td colSpan={4} className="p-4 space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                      {survey.questions.map(q => {
                                        const ans = resp.answers[q.id];
                                        return (
                                          <div
                                            key={q.id}
                                            className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1"
                                          >
                                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                                              {q.title}
                                            </span>
                                            <div className="font-medium text-slate-800 dark:text-slate-100">
                                              {Array.isArray(ans)
                                                ? ans.join(', ')
                                                : ans !== undefined && ans !== null && ans !== ''
                                                ? String(ans)
                                                : <span className="text-slate-400 italic">Keine Antwort</span>}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            {responses.length} Stimmabgabe(n) insgesamt erfasst
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
