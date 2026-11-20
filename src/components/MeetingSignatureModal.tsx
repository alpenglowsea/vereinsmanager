import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Check,
  Trash2,
  Download,
  RotateCcw,
  PenTool,
  CheckCircle2,
  FileText,
  User,
  ShieldCheck,
  Smartphone,
  MousePointer
} from 'lucide-react';
import { Meeting, ClubSettings, MeetingTemplateSettings } from '../types';
import { MeetingPdfService, Briefpapier } from '../services/meetingPdfService';
import { savePdfAs } from '../utils/fileExportHelper';
import { bestaetige } from '../utils/dialoge';
import { unterschriftAusZeichnung } from '../utils/unterschrift';
import {
  ROLLE_LEITUNG,
  ROLLE_SCHRIFT,
  leitungsUnterschrift,
  pruefeUnterschrift,
  schriftUnterschrift,
  unterschreibe,
  unterschriftenEntfernen
} from '../utils/sitzungRegeln';

interface MeetingSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: Meeting;
  clubSettings?: ClubSettings;
  templateSettings?: MeetingTemplateSettings;
  briefpapier?: Briefpapier | null;
  onSaveMeeting: (updatedMeeting: Meeting) => Promise<void>;
}

export const MeetingSignatureModal: React.FC<MeetingSignatureModalProps> = ({
  isOpen,
  onClose,
  meeting,
  clubSettings,
  templateSettings,
  briefpapier,
  onSaveMeeting
}) => {
  const [activeRole, setActiveRole] = useState<'chairperson' | 'minuteKeeper'>('chairperson');
  // Die Unterschriften kommen immer aus der gespeicherten Sitzung (die Liste
  // reicht nach dem Speichern die neue Fassung herein).
  const signatures = meeting.signatures || [];
  const [meldung, setMeldung] = useState<string | null>(null);
  // Linienzüge zusätzlich zum Bild speichern (Format wie Android), damit die
  // Unterschrift im PDF und am Handy scharf erscheint.
  const stricheRef = useRef<{ x: number; y: number }[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnStroke, setHasDrawnStroke] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Signatory details
  // Ohne eingetragenen Namen kann nicht unterschrieben werden (wie Android).
  const chairpersonName = (meeting.chairperson || '').trim();
  const minuteKeeperName = (meeting.minuteKeeper || '').trim();

  const currentSignatoryName = activeRole === 'chairperson' ? chairpersonName : minuteKeeperName;
  const currentSignatoryRoleLabel = activeRole === 'chairperson' ? 'Versammlungsleitung' : 'Protokollführung';

  // Zuordnung über die gespeicherte Rolle (vorher auch über Namen)
  const existingChairpersonSig = leitungsUnterschrift(meeting);
  const existingMinuteKeeperSig = schriftUnterschrift(meeting);
  const anzahlUnterschriften = (existingChairpersonSig ? 1 : 0) + (existingMinuteKeeperSig ? 1 : 0);
  const abgesagt = meeting.status === 'cancelled';

  const currentSignature = activeRole === 'chairperson' ? existingChairpersonSig : existingMinuteKeeperSig;
  const pruefText = (p: ReturnType<typeof pruefeUnterschrift>) =>
    p === 'gueltig'
      ? 'passt zum gespeicherten Protokolltext'
      : p === 'geaendert'
        ? 'ACHTUNG: Der Protokolltext wurde nach dieser Unterschrift geändert'
        : 'ältere Unterschrift ohne Prüfmerkmal';

  // Initialize Canvas
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0f172a'; // slate-900 for dark crisp ink
      ctx.clearRect(0, 0, rect.width, rect.height);
    }
    setHasDrawnStroke(false);
    lastPointRef.current = null;
    stricheRef.current = [];
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Give DOM time to render canvas then setup
      const timer = setTimeout(() => {
        setupCanvas();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeRole, meeting.signatures, setupCanvas]);

  // Touch and pointer drawing logic
  const getCanvasCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Capture pointer to track outside canvas
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if not supported
    }

    const coords = getCanvasCoordinates(e);
    setIsDrawing(true);
    setHasDrawnStroke(true);
    lastPointRef.current = coords;
    stricheRef.current.push([coords]);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentPoint = getCanvasCoordinates(e);
    stricheRef.current[stricheRef.current.length - 1]?.push(currentPoint);

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    // Smooth quadratic curve interpolation
    const midX = (lastPointRef.current.x + currentPoint.x) / 2;
    const midY = (lastPointRef.current.y + currentPoint.y) / 2;
    ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();

    lastPointRef.current = currentPoint;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }
  };

  const handleClearCanvas = () => {
    setupCanvas();
  };

  /**
   * Unterschrift übernehmen: mit Fingerabdruck des Protokolltextes; mit der
   * zweiten Unterschrift wird das Protokoll „Genehmigt“ (D-117, wie Android).
   */
  const handleSaveCurrentSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnStroke) return;

    setIsSaving(true);
    setMeldung(null);
    try {
      const rect = canvas.getBoundingClientRect();
      const linien = unterschriftAusZeichnung(stricheRef.current, rect.width, rect.height);
      const updatedMeeting = unterschreibe(meeting, activeRole === 'chairperson' ? ROLLE_LEITUNG : ROLLE_SCHRIFT, {
        dataUrl: canvas.toDataURL('image/png'),
        aspect: linien?.aspect,
        strokes: linien?.strokes,
        geraet: typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 'Touch-Eingabe (Finger / Stylus)' : 'Maus-Eingabe (Desktop)'
      });
      await onSaveMeeting(updatedMeeting);
      setupCanvas();
    } catch (err) {
      setMeldung(err instanceof Error ? err.message : 'Die Unterschrift konnte nicht gespeichert werden.');
    } finally {
      setIsSaving(false);
    }
  };

  /** Alle Unterschriften entfernen und das Protokoll wieder zum Bearbeiten freigeben (wie Android). */
  const handleRemoveSignatures = async () => {
    if (
      !(await bestaetige(
        'Alle Unterschriften entfernen? Danach ist das Protokoll wieder bearbeitbar; aus „Genehmigt“ wird „In Vorprüfung“. Unterschreiben müssen danach beide erneut.',
        'Unterschriften entfernen'
      ))
    )
      return;
    setIsSaving(true);
    try {
      await onSaveMeeting(unterschriftenEntfernen(meeting));
      setupCanvas();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = async (withDigitalSignatures: boolean) => {
    if (!clubSettings) return;
    setIsExporting(withDigitalSignatures ? 'signed' : 'blank');
    try {
      const doc = await MeetingPdfService.generateProtocolPdf(meeting, clubSettings, templateSettings, {
        includeDigitalSignatures: withDigitalSignatures,
        briefpapier
      });
      const safeTitle = (meeting.title || 'Protokoll').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_');
      const suffix = withDigitalSignatures ? 'digital_signiert' : 'blanko_ausdruck';
      void savePdfAs(doc, `Protokoll_${safeTitle}_${suffix}.pdf`);
    } catch (err) {
      console.error('Failed to export protocol PDF:', err);
    } finally {
      setIsExporting(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] dark:bg-slate-900 dark:border-slate-800">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between dark:border-slate-800 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-2xs dark:bg-rose-900/40 dark:text-rose-300">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Digitales Signaturfeld & Protokollunterzeichnung
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {meeting.title} • Gem. § 32 BGB & Satzung
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer dark:hover:text-slate-300 dark:hover:bg-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Guidance */}
        <div className="px-6 py-2.5 bg-blue-50/80 border-b border-blue-100 flex items-center justify-between gap-3 dark:bg-blue-950/80 dark:border-blue-900/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 dark:text-blue-400" />
            <span className="text-xs text-blue-800 dark:text-blue-200">
              Unterstützt <strong>Touch-Eingabe (Finger / Stylus auf Smartphone & Tablet)</strong> sowie <strong>Mauszeiger (PC / Laptop)</strong>.
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-slate-400 text-xs">
            <Smartphone className="w-3.5 h-3.5" />
            <span>&bull;</span>
            <MousePointer className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Signatory Selector Tabs */}
        <div className="px-6 border-b border-slate-200 bg-white flex items-center gap-4 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => {
              setActiveRole('chairperson');
              setupCanvas();
            }}
            className={`py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeRole === 'chairperson'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>1. Versammlungsleitung ({chairpersonName || 'kein Name eingetragen'})</span>
            {existingChairpersonSig ? (
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold flex items-center gap-0.5 dark:bg-emerald-900/40 dark:text-emerald-200">
                <Check className="w-3 h-3" />
                Signiert
              </span>
            ) : (
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-medium dark:bg-amber-900/40 dark:text-amber-200">
                Offen
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveRole('minuteKeeper');
              setupCanvas();
            }}
            className={`py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeRole === 'minuteKeeper'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>2. Protokollführung ({minuteKeeperName || 'kein Name eingetragen'})</span>
            {existingMinuteKeeperSig ? (
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold flex items-center gap-0.5 dark:bg-emerald-900/40 dark:text-emerald-200">
                <Check className="w-3 h-3" />
                Signiert
              </span>
            ) : (
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-medium dark:bg-amber-900/40 dark:text-amber-200">
                Offen
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Active Signatory Info Card */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex flex-wrap items-center justify-between gap-3 dark:bg-slate-800 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block dark:text-slate-400">
                Zu unterzeichnende Person
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {currentSignatoryName || 'Kein Name eingetragen – bitte zuerst in der Sitzung ergänzen'}
              </span>
              <span className="text-xs text-slate-500 ml-1.5 dark:text-slate-400">
                ({currentSignatoryRoleLabel})
              </span>
            </div>

            {currentSignature && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/60">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Signiert am {new Date(currentSignature.signedAt).toLocaleDateString('de-DE')} um {new Date(currentSignature.signedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                </span>

              </div>
            )}
          </div>

          {/* Current Saved Signature Preview (if already exists) */}
          {currentSignature && (
            <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 dark:border-emerald-800/60 dark:bg-emerald-950/40">
              <div>
                <span className="text-xs font-bold text-emerald-900 block mb-1 dark:text-emerald-100">
                  Unterschrift von {currentSignature.name} hinterlegt
                </span>
                <p
                  className={`text-[11px] ${pruefeUnterschrift(meeting, currentSignature) === 'geaendert' ? 'text-rose-700 font-bold dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}
                >
                  Prüfung: {pruefText(pruefeUnterschrift(meeting, currentSignature))}.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-2xs shrink-0 dark:bg-slate-900 dark:border-slate-800">
                <img
                  src={currentSignature.signatureDataUrl}
                  alt={`Unterschrift von ${currentSignatoryName}`}
                  className="h-12 w-36 object-contain"
                />
              </div>
            </div>
          )}

          {abgesagt && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 dark:text-amber-200 dark:bg-amber-950/40 dark:border-amber-800/60">
              Die Sitzung ist abgesagt; ihr Protokoll wird nicht unterschrieben.
            </div>
          )}

          {/* Canvas Signature Pad Area */}
          <div className={`space-y-2${abgesagt || !currentSignatoryName ? ' hidden' : ''}`}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 dark:text-slate-200">
                <PenTool className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>
                  {currentSignature ? 'Neue Unterschrift zeichnen (überschreibt bestehende)' : 'Unterschrift zeichnen'}
                </span>
              </label>
              <button
                type="button"
                onClick={handleClearCanvas}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer dark:text-slate-400 dark:hover:text-slate-100"
                title="Zeichenfläche leeren"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Leeren</span>
              </button>
            </div>

            {/* Canvas Box with baseline */}
            <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/80 overflow-hidden shadow-inner group focus-within:border-rose-500 dark:border-slate-700 dark:bg-slate-800/80">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerUp}
                style={{ touchAction: 'none' }}
                className="w-full h-44 cursor-crosshair block select-none"
              />

              {/* Baseline guideline */}
              <div className="absolute left-6 right-6 bottom-8 border-b border-slate-300/80 pointer-events-none flex items-center justify-between dark:border-slate-700">
                <span className="text-[10px] text-slate-400 select-none">
                  Unterschriftslinie
                </span>
                <span className="text-[10px] text-slate-400 select-none">
                  X
                </span>
              </div>

              {!hasDrawnStroke && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs gap-2 select-none">
                  <PenTool className="w-4 h-4 opacity-50" />
                  <span>Hier mit Finger oder Maus unterschreiben</span>
                </div>
              )}
            </div>

            {/* Signature Save Button */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {meldung ? (
                  <span className="font-semibold text-rose-600 dark:text-rose-400">{meldung}</span>
                ) : (
                  'Mit der Unterschrift wird der Protokolltext gesperrt; mit beiden Unterschriften ist er genehmigt.'
                )}
              </span>
              <button
                type="button"
                onClick={handleSaveCurrentSignature}
                disabled={!hasDrawnStroke || isSaving}
                className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  hasDrawnStroke && !isSaving
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed dark:bg-slate-700 dark:border-slate-800'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Wird gespeichert...' : 'Unterschrift übernehmen'}</span>
              </button>
            </div>
          </div>

          {/* PDF Download Options Section */}
          <div className="border-t border-slate-200 pt-4 space-y-3 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 dark:text-slate-100">
              <FileText className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              <span>Protokoll-Download Optionen</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleDownloadPdf(true)}
                disabled={Boolean(isExporting) || anzahlUnterschriften === 0}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between shadow-2xs ${
                  anzahlUnterschriften > 0
                    ? 'border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 cursor-pointer dark:border-rose-800/60 dark:bg-rose-950/50 dark:hover:bg-rose-900/60'
                    : 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed dark:border-slate-800 dark:bg-slate-800'
                }`}
                title={anzahlUnterschriften > 0 ? 'Erzeugt PDF mit den hinterlegten digitalen Unterschriften' : 'Erst mindestens eine Unterschrift erfassen'}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5 dark:text-rose-100">
                    <Download className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Mit digitaler Unterschrift</span>
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] bg-rose-200/80 text-rose-800 font-bold rounded dark:bg-rose-900/80 dark:text-rose-200">
                    {anzahlUnterschriften}/2 signiert
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Fügt die digitalen Signaturen und Zeitstempel direkt in das Protokoll-PDF ein.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadPdf(false)}
                disabled={Boolean(isExporting)}
                className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition-all flex flex-col justify-between shadow-2xs cursor-pointer dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                title="Erzeugt das Protokoll mit freier Blanko-Signaturzeile zum handschriftlichen Unterzeichnen"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 dark:text-slate-100">
                    <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                    <span>Ohne Unterschrift (Blanko)</span>
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-700 font-bold rounded dark:bg-slate-700 dark:text-slate-200">
                    Zum Ausdrucken
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Erzeugt das Protokoll mit klassischer Signaturzeile zum manuellen Ausdruck und handschriftlichen Zeichnen.
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between dark:border-slate-800 dark:bg-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Status: {anzahlUnterschriften === 2 ? 'Beide Unterschriften erfasst, Protokoll genehmigt.' : `${anzahlUnterschriften} von 2 Unterschriften vorhanden.`}
          </span>
          {signatures.length > 0 && (
            <button
              type="button"
              onClick={handleRemoveSignatures}
              disabled={isSaving}
              className="ml-auto mr-2 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl flex items-center gap-1.5 dark:text-rose-300 dark:bg-rose-950/40 dark:border-rose-800/60"
              title="Entfernt beide Unterschriften und gibt das Protokoll zum Bearbeiten frei"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Unterschriften entfernen</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shadow-2xs dark:text-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-700"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
