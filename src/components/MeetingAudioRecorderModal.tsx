import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Mic,
  Square,
  Play,
  Pause,
  Upload,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ShieldAlert,
  Volume2,
  Radio,
  FileAudio
} from 'lucide-react';
import { MeetingType } from '../types';
import { MeetingAiService, MeetingExtractedData } from '../services/meetingAiService';

interface MeetingAudioRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyExtractedData: (data: MeetingExtractedData) => void;
  currentMeetingContext?: {
    title?: string;
    type?: MeetingType;
    date?: string;
  };
}

export const MeetingAudioRecorderModal: React.FC<MeetingAudioRecorderModalProps> = ({
  isOpen,
  onClose,
  onApplyExtractedData,
  currentMeetingContext,
}) => {
  const [meetingType, setMeetingType] = useState<MeetingType>(currentMeetingContext?.type || 'board');
  const [tab, setTab] = useState<'record' | 'upload'>('record');

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>('Sitzungsmitschnitt.webm');

  // File upload state
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);

  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [extractedResult, setExtractedResult] = useState<MeetingExtractedData | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGeneralAssembly = meetingType === 'general_assembly' || meetingType === 'extraordinary_assembly';

  useEffect(() => {
    if (!isOpen) {
      cleanupRecording();
    }
  }, [isOpen]);

  // Clean up timers & audio blobs
  const cleanupRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setIsPaused(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  if (!isOpen) return null;

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    setAnalysisError(null);
    setRecordedAudioBlob(null);
    setAudioUrl(null);
    setExtractedResult(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : undefined,
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mime = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        setRecordedAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioFileName(`Aufnahme_${new Date().toISOString().slice(0, 10)}.webm`);
        // Stop audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(1000); // 1-second chunks
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      setAnalysisError(
        'Mikrofon-Zugriff nicht möglich. Bitte erlauben Sie den Mikrofon-Zugriff im Browser oder laden Sie eine Audiodatei hoch.'
      );
    }
  };

  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        timerRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedAudioFile(file);
      setAudioFileName(file.name);
      setAudioUrl(URL.createObjectURL(file));
      setExtractedResult(null);
      setAnalysisError(null);
    }
  };

  const handleStartAnalysis = async () => {
    const audioData = tab === 'record' ? recordedAudioBlob : uploadedAudioFile;
    if (!audioData) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const result = await MeetingAiService.analyzeAudio(audioData, audioFileName, {
        title: currentMeetingContext?.title,
        type: meetingType,
        date: currentMeetingContext?.date,
      });

      setExtractedResult(result);
    } catch (err: any) {
      console.error('Audio analysis error:', err);
      setAnalysisError(err.message || 'Die Audio-Aufnahme konnte nicht analysiert werden.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (extractedResult) {
      onApplyExtractedData(extractedResult);
      cleanupRecording();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-2xs">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Audio-Erfassung & Direktauswertung
              </h2>
              <p className="text-xs text-slate-500">
                Vorstandssitzungen & Ausschüsse live aufnehmen oder Audiodatei hochladen.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              cleanupRecording();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Meeting Type Selector (if not given) */}
          {!currentMeetingContext?.type && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Sitzungsart
              </label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value as MeetingType)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-rose-500"
              >
                <option value="board">Vorstandssitzung (zulässig)</option>
                <option value="committee">Ausschuss / Fachbereich (zulässig)</option>
                <option value="department">Abteilungsversammlung (zulässig)</option>
                <option value="other">Sonstige Gremiensitzung (zulässig)</option>
                <option value="general_assembly">Ordentliche Mitgliederversammlung (gesperrt)</option>
                <option value="extraordinary_assembly">Außerordentliche Mitgliederversammlung (gesperrt)</option>
              </select>
            </div>
          )}

          {/* BLOCK FOR GENERAL ASSEMBLY */}
          {isGeneralAssembly ? (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-white text-amber-600 shadow-xs border border-amber-200 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div className="max-w-lg mx-auto space-y-2">
                <h3 className="text-sm font-bold text-amber-900">
                  Audio-Erfassung für Mitgliederversammlungen deaktiviert
                </h3>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Aufgrund der hohen Personenanzahl, der Stimmenvielfalt und strenger Datenschutzvorgaben (Art. 6 DSGVO, § 201 StGB – Schutz der Vertraulichkeit des nichtöffentlich gesprochenen Wortes) ist ein Audio-Mitschnitt bei Mitgliederversammlungen nicht gestattet.
                </p>
                <p className="text-xs font-semibold text-amber-900 pt-1">
                  💡 Bitte nutzen Sie für Mitgliederversammlungen die Funktion <strong>„Notizen hochladen (PDF/Scan)“</strong> oder den <strong>KI-Entwurfsassistenten</strong> zur schrittweisen Erfassung der Beschlüsse.
                </p>
              </div>
            </div>
          ) : !extractedResult ? (
            /* ALLOWED FOR BOARD / COMMITTEES */
            <div className="space-y-5">
              {/* Tab Selector: Live Record vs Audio Upload */}
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTab('record')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    tab === 'record'
                      ? 'bg-white text-purple-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Live im Raum aufnehmen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('upload')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    tab === 'upload'
                      ? 'bg-white text-purple-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Audiodatei hochladen (.mp3, .m4a, .wav, .webm)</span>
                </button>
              </div>

              {/* LIVE RECORDING TAB */}
              {tab === 'record' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    {isRecording ? (
                      <div className="flex items-center gap-2 px-3 py-1 bg-rose-100 border border-rose-200 rounded-full text-rose-700 text-xs font-bold animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-rose-600" />
                        <span>{isPaused ? 'Aufnahme pausiert' : 'Aufnahme läuft...'}</span>
                      </div>
                    ) : recordedAudioBlob ? (
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 border border-emerald-200 rounded-full text-emerald-700 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Aufnahme bereit</span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 font-medium">
                        Bereit für Sitzungsmitschnitt (Vorstand / Ausschuss)
                      </div>
                    )}
                  </div>

                  {/* Timer Display */}
                  <div className="text-4xl font-black tracking-tight text-slate-900 font-mono">
                    {formatTime(recordingSeconds)}
                  </div>

                  {/* Recording Controls */}
                  <div className="flex items-center justify-center gap-3">
                    {!isRecording && !recordedAudioBlob && (
                      <button
                        type="button"
                        onClick={handleStartRecording}
                        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-purple-200 flex items-center gap-2 transition-all cursor-pointer hover:scale-105"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Aufnahme starten</span>
                      </button>
                    )}

                    {isRecording && (
                      <>
                        <button
                          type="button"
                          onClick={handlePauseRecording}
                          className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                          <span>{isPaused ? 'Fortsetzen' : 'Pause'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleStopRecording}
                          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Square className="w-4 h-4" />
                          <span>Aufnahme beenden</span>
                        </button>
                      </>
                    )}

                    {!isRecording && recordedAudioBlob && (
                      <button
                        type="button"
                        onClick={handleStartRecording}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Neu aufnehmen
                      </button>
                    )}
                  </div>

                  {/* Audio Player for preview */}
                  {audioUrl && !isRecording && (
                    <div className="pt-2 border-t border-slate-200">
                      <audio controls src={audioUrl} className="w-full h-10 mx-auto" />
                    </div>
                  )}
                </div>
              )}

              {/* AUDIO UPLOAD TAB */}
              {tab === 'upload' && (
                <div className="space-y-4">
                  {!uploadedAudioFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/40 hover:bg-purple-50/70 transition-all rounded-2xl p-8 text-center cursor-pointer flex flex-col items-center justify-center gap-3 group"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white text-purple-600 shadow-xs border border-purple-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <FileAudio className="w-7 h-7" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-800 block">
                          Audiodatei hier auswählen (.mp3, .m4a, .wav, .webm, .ogg)
                        </span>
                        <span className="text-xs text-slate-500 mt-0.5 block">
                          Ideal für Sprachmemos vom Smartphone oder Diktiergerät
                        </span>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg"
                        onChange={handleAudioFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        className="mt-2 px-4 py-2 bg-white text-purple-700 border border-purple-200 rounded-xl text-xs font-bold shadow-2xs hover:bg-purple-50"
                      >
                        Audiodatei auswählen
                      </button>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                          <FileAudio className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{uploadedAudioFile.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {(uploadedAudioFile.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedAudioFile(null);
                          setAudioUrl(null);
                        }}
                        className="text-xs font-semibold text-slate-500 hover:text-rose-600 cursor-pointer"
                      >
                        Entfernen
                      </button>
                    </div>
                  )}

                  {audioUrl && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <audio controls src={audioUrl} className="w-full h-10" />
                    </div>
                  )}
                </div>
              )}

              {/* Analysis error */}
              {analysisError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Fehler: </span>
                    {analysisError}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* RESULTS REVIEW */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-emerald-900">
                    Audioaufnahme erfolgreich transkribiert & ausgewertet!
                  </h3>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    {extractedResult.agenda.length} TOPs und{' '}
                    {extractedResult.agenda.reduce((acc, t) => acc + (t.resolutions?.length || 0), 0)} Beschlüsse erfasst.
                  </p>
                </div>
              </div>

              {/* Extracted overview */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block">Titel:</span>
                    <span className="font-bold text-slate-800">{extractedResult.title || 'Sitzung'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Datum:</span>
                    <span className="font-bold text-slate-800">{extractedResult.date || 'Heute'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700 block mb-2">
                    Erkannte Tagesordnungspunkte:
                  </span>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {extractedResult.agenda.map((top, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs flex items-center justify-between"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-bold text-purple-700 mr-2">{top.number}:</span>
                          <span className="font-semibold text-slate-800">{top.title}</span>
                          {top.discussionNotes && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {top.discussionNotes}
                            </p>
                          )}
                        </div>
                        {top.resolutions && top.resolutions.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 shrink-0">
                            {top.resolutions.length} Beschluss
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {extractedResult.transcriptSummary && (
                  <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 bg-white/60 p-2.5 rounded-xl">
                    <span className="font-bold text-slate-700 block mb-0.5">Transkript-Essenz:</span>
                    {extractedResult.transcriptSummary}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/70">
          <button
            type="button"
            onClick={() => {
              cleanupRecording();
              onClose();
            }}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Schließen
          </button>

          {!isGeneralAssembly && !extractedResult && (
            <button
              type="button"
              disabled={(!recordedAudioBlob && !uploadedAudioFile) || isRecording || isAnalyzing}
              onClick={handleStartAnalysis}
              className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer ${
                (!recordedAudioBlob && !uploadedAudioFile) || isRecording || isAnalyzing
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-200'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gemini transkribiert & strukturiert Audio...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Audio auswerten & Protokoll entwerfen</span>
                </>
              )}
            </button>
          )}

          {extractedResult && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setExtractedResult(null);
                  setRecordedAudioBlob(null);
                  setUploadedAudioFile(null);
                  setAudioUrl(null);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Zurück
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-5 py-2.5 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>In Protokoll-Editor übernehmen & bearbeiten</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
