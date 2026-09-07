import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Scale,
  FileText,
  ListChecks,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import { MeetingType, MeetingResolution, MeetingAgendaItem } from '../types';
import { MeetingAiService } from '../services/meetingAiService';

interface MeetingAiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'resolution' | 'discussion' | 'agenda';
  initialInput?: string;
  context?: {
    meetingTitle?: string;
    meetingType?: MeetingType;
    topTitle?: string;
  };
  onApplyResolution?: (res: Partial<MeetingResolution>) => void;
  onApplyDiscussion?: (text: string) => void;
  onApplyAgenda?: (items: { number: string; title: string; description?: string }[]) => void;
}

export const MeetingAiAssistantModal: React.FC<MeetingAiAssistantModalProps> = ({
  isOpen,
  onClose,
  mode,
  initialInput = '',
  context,
  onApplyResolution,
  onApplyDiscussion,
  onApplyAgenda,
}) => {
  const [currentMode, setCurrentMode] = useState<'resolution' | 'discussion' | 'agenda'>(mode);
  const [inputText, setInputText] = useState(initialInput);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Results
  const [resolutionResult, setResolutionResult] = useState<any>(null);
  const [discussionResult, setDiscussionResult] = useState<string | null>(null);
  const [agendaResult, setAgendaResult] = useState<any[] | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (currentMode === 'resolution') {
        const res = await MeetingAiService.assistDraft<any>('formulate_resolution', inputText, context);
        setResolutionResult(res);
      } else if (currentMode === 'discussion') {
        const text = await MeetingAiService.assistDraft<string>('polish_discussion', inputText, context);
        setDiscussionResult(text);
      } else if (currentMode === 'agenda') {
        const items = await MeetingAiService.assistDraft<any[]>('suggest_agenda', inputText, context);
        setAgendaResult(items);
      }
    } catch (err: any) {
      console.error('AI assistant error:', err);
      setErrorMessage(err.message || 'Die KI-Generierung ist fehlgeschlagen.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (currentMode === 'resolution' && resolutionResult && onApplyResolution) {
      onApplyResolution({
        title: resolutionResult.title,
        motionText: resolutionResult.motionText,
        proposer: resolutionResult.proposer,
        result: resolutionResult.result || 'accepted',
        isTaxRelevant: Boolean(resolutionResult.isTaxRelevant),
        isRegisterRelevant: Boolean(resolutionResult.isRegisterRelevant),
        responsiblePerson: resolutionResult.responsiblePerson,
        notes: resolutionResult.notes,
      });
      onClose();
    } else if (currentMode === 'discussion' && discussionResult && onApplyDiscussion) {
      onApplyDiscussion(discussionResult);
      onClose();
    } else if (currentMode === 'agenda' && agendaResult && onApplyAgenda) {
      onApplyAgenda(agendaResult);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                KI-Entwurfsassistent für Vereinssitzungen
              </h2>
              <p className="text-xs text-slate-500">
                Rechtssichere Beschlussformulierungen & professionelle Protokolltexte
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="px-6 pt-4 pb-0">
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setCurrentMode('resolution');
                setResolutionResult(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                currentMode === 'resolution'
                  ? 'bg-white text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Beschluss formulieren</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentMode('discussion');
                setDiscussionResult(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                currentMode === 'discussion'
                  ? 'bg-white text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Diskussion glätten</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentMode('agenda');
                setAgendaResult(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                currentMode === 'agenda'
                  ? 'bg-white text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Tagesordnung</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {currentMode === 'resolution' && 'Beschluss-Idee oder Stichworte eingeben:'}
              {currentMode === 'discussion' && 'Rohe Notizen aus der Aussprache / Diskussion:'}
              {currentMode === 'agenda' && 'Anlass oder thematische Schwerpunkte der Sitzung:'}
            </label>
            <textarea
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                currentMode === 'resolution'
                  ? 'z. B.: 600 Euro für neue Trainingsjacken der Jugendmannschaft freigeben, Angebot Sport Meyer vorliegend, Antragsteller Michael'
                  : currentMode === 'discussion'
                  ? 'z. B.: Vorstand diskutiert über Heizkosten im Vereinsheim. Sabine meint Thermostate erneuern. Michael schlägt Angebot von Fa. HeizFix einholen vor bis Ende Mai.'
                  : 'z. B.: Vorstandssitzung im Frühjahr mit Schwerpunkt Vorbereitung Sommerfest und Budgetplanung'
              }
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-hidden transition-all"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={isLoading || !inputText.trim()}
              onClick={handleGenerate}
              className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer ${
                isLoading || !inputText.trim()
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-rose-600 text-white hover:bg-rose-700'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Wird formuliert...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Jetzt formulieren</span>
                </>
              )}
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* RESULTS DISPLAY */}
          {currentMode === 'resolution' && resolutionResult && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Rechtssicherer Beschlussentwurf:
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  § 32 BGB Konform
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-semibold block">Titel:</span>
                <span className="text-xs font-bold text-slate-900">{resolutionResult.title}</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Antragswortlaut (Beschlusstext):
                </span>
                <p className="text-xs text-slate-800 font-medium leading-relaxed">
                  {resolutionResult.motionText}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px]">
                {resolutionResult.isTaxRelevant && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-amber-600" />
                    Steuerlich relevant (Finanzamt / AO)
                  </span>
                )}
                {resolutionResult.isRegisterRelevant && (
                  <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold flex items-center gap-1">
                    <Scale className="w-3 h-3 text-purple-600" />
                    Registerrelevant (Vereinsregister § 26 / 33 BGB)
                  </span>
                )}
              </div>

              {resolutionResult.notes && (
                <p className="text-[11px] text-slate-500 italic">
                  Hinweis: {resolutionResult.notes}
                </p>
              )}
            </div>
          )}

          {currentMode === 'discussion' && discussionResult && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                Sachlicher Protokolltext (Ergebnisprotokoll):
              </span>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                {discussionResult}
              </div>
            </div>
          )}

          {currentMode === 'agenda' && agendaResult && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                Empfohlene Tagesordnung ({agendaResult.length} TOPs):
              </span>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {agendaResult.map((top, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-rose-700 mr-2">{top.number}:</span>
                      <span className="font-semibold text-slate-800">{top.title}</span>
                      {top.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{top.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Abbrechen
          </button>

          {(resolutionResult || discussionResult || agendaResult) && (
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>In Sitzung übernehmen</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
