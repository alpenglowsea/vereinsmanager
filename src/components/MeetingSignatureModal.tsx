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
import { Meeting, MeetingDigitalSignature, ClubSettings, MeetingTemplateSettings } from '../types';
import { MeetingPdfService } from '../services/meetingPdfService';

interface MeetingSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: Meeting;
  clubSettings?: ClubSettings;
  templateSettings?: MeetingTemplateSettings;
  onSaveMeeting: (updatedMeeting: Meeting) => Promise<void>;
}

export const MeetingSignatureModal: React.FC<MeetingSignatureModalProps> = ({
  isOpen,
  onClose,
  meeting,
  clubSettings,
  templateSettings,
  onSaveMeeting
}) => {
  const [activeRole, setActiveRole] = useState<'chairperson' | 'minuteKeeper'>('chairperson');
  const [signatures, setSignatures] = useState<MeetingDigitalSignature[]>(meeting.signatures || []);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnStroke, setHasDrawnStroke] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Signatory details
  const chairpersonName = meeting.chairperson || 'Versammlungsleiter';
  const minuteKeeperName = meeting.minuteKeeper || 'Protokollführer / Schriftführer';

  const currentSignatoryName = activeRole === 'chairperson' ? chairpersonName : minuteKeeperName;
  const currentSignatoryRoleLabel = activeRole === 'chairperson' ? 'Versammlungsleitung gem. Satzung' : 'Protokollführung gem. Satzung';

  const existingChairpersonSig = signatures.find(s =>
    s.role.toLowerCase().includes('leiter') ||
    s.role.toLowerCase().includes('vorsitz') ||
    s.name.toLowerCase() === chairpersonName.toLowerCase()
  );

  const existingMinuteKeeperSig = signatures.find(s =>
    s !== existingChairpersonSig && (
      s.role.toLowerCase().includes('schrift') ||
      s.role.toLowerCase().includes('protokoll') ||
      s.name.toLowerCase() === minuteKeeperName.toLowerCase()
    )
  );

  const currentSignature = activeRole === 'chairperson' ? existingChairpersonSig : existingMinuteKeeperSig;

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
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSignatures(meeting.signatures || []);
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

  const handleSaveCurrentSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnStroke) return;

    setIsSaving(true);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const nowIso = new Date().toISOString();

      const newSig: MeetingDigitalSignature = {
        id: `sig-${Date.now()}-${activeRole}`,
        name: currentSignatoryName,
        role: currentSignatoryRoleLabel,
        signatureDataUrl: dataUrl,
        signedAt: nowIso,
        deviceInfo: typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 'Touch-Eingabe (Finger / Stylus)' : 'Maus-Eingabe (Desktop)'
      };

      // Filter out existing signature for this role
      const updatedSigs = signatures.filter(s => {
        if (activeRole === 'chairperson') {
          return s !== existingChairpersonSig;
        } else {
          return s !== existingMinuteKeeperSig;
        }
      });

      const nextSigs = [...updatedSigs, newSig];
      setSignatures(nextSigs);

      // Save to meeting model
      const updatedMeeting: Meeting = {
        ...meeting,
        signatures: nextSigs,
        signedAt: meeting.signedAt || nowIso.split('T')[0],
        updatedAt: nowIso
      };

      await onSaveMeeting(updatedMeeting);
      setupCanvas();
    } catch (err) {
      console.error('Failed to save signature:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveSignature = async (roleToRemove: 'chairperson' | 'minuteKeeper') => {
    const sigToRemove = roleToRemove === 'chairperson' ? existingChairpersonSig : existingMinuteKeeperSig;
    if (!sigToRemove) return;

    setIsSaving(true);
    try {
      const nextSigs = signatures.filter(s => s !== sigToRemove);
      setSignatures(nextSigs);

      const updatedMeeting: Meeting = {
        ...meeting,
        signatures: nextSigs,
        updatedAt: new Date().toISOString()
      };

      await onSaveMeeting(updatedMeeting);
      setupCanvas();
    } catch (err) {
      console.error('Failed to remove signature:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = async (withDigitalSignatures: boolean) => {
    if (!clubSettings) return;
    setIsExporting(withDigitalSignatures ? 'signed' : 'blank');
    try {
      const doc = await MeetingPdfService.generateProtocolPdf(
        { ...meeting, signatures },
        clubSettings,
        templateSettings,
        { includeDigitalSignatures: withDigitalSignatures }
      );
      const safeTitle = (meeting.title || 'Protokoll').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_');
      const suffix = withDigitalSignatures ? 'digital_signiert' : 'blanko_ausdruck';
      doc.save(`Protokoll_${safeTitle}_${suffix}.pdf`);
    } catch (err) {
      console.error('Failed to export protocol PDF:', err);
    } finally {
      setIsExporting(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-2xs">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Digitales Signaturfeld & Protokollunterzeichnung
              </h3>
              <p className="text-xs text-slate-500">
                {meeting.title} • Gem. § 32 BGB & Satzung
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Guidance */}
        <div className="px-6 py-2.5 bg-blue-50/80 border-b border-blue-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs text-blue-800">
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
        <div className="px-6 border-b border-slate-200 bg-white flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              setActiveRole('chairperson');
              setupCanvas();
            }}
            className={`py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeRole === 'chairperson'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>1. Versammlungsleitung ({chairpersonName})</span>
            {existingChairpersonSig ? (
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold flex items-center gap-0.5">
                <Check className="w-3 h-3" />
                Signiert
              </span>
            ) : (
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-medium">
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
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>2. Protokollführung ({minuteKeeperName})</span>
            {existingMinuteKeeperSig ? (
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold flex items-center gap-0.5">
                <Check className="w-3 h-3" />
                Signiert
              </span>
            ) : (
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-medium">
                Offen
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Active Signatory Info Card */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Zu unterzeichnende Person
              </span>
              <span className="text-sm font-bold text-slate-800">
                {currentSignatoryName}
              </span>
              <span className="text-xs text-slate-500 ml-1.5">
                ({currentSignatoryRoleLabel})
              </span>
            </div>

            {currentSignature && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Signiert am {new Date(currentSignature.signedAt).toLocaleDateString('de-DE')} um {new Date(currentSignature.signedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveSignature(activeRole)}
                  disabled={isSaving}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Unterschrift löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Current Saved Signature Preview (if already exists) */}
          {currentSignature && (
            <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-emerald-900 block mb-1">
                  Gültige digitale Unterschrift hinterlegt
                </span>
                <p className="text-[11px] text-emerald-700">
                  Wird beim PDF-Export automatisch über der Unterschriftslinie und mit offiziellem Zeitstempel eingefügt.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-2xs shrink-0">
                <img
                  src={currentSignature.signatureDataUrl}
                  alt={`Unterschrift von ${currentSignatoryName}`}
                  className="h-12 w-36 object-contain"
                />
              </div>
            </div>
          )}

          {/* Canvas Signature Pad Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-rose-600" />
                <span>
                  {currentSignature ? 'Neue Unterschrift zeichnen (überschreibt bestehende)' : 'Unterschrift zeichnen'}
                </span>
              </label>
              <button
                type="button"
                onClick={handleClearCanvas}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                title="Zeichenfläche leeren"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Leeren</span>
              </button>
            </div>

            {/* Canvas Box with baseline */}
            <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/80 overflow-hidden shadow-inner group focus-within:border-rose-500">
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
              <div className="absolute left-6 right-6 bottom-8 border-b border-slate-300/80 pointer-events-none flex items-center justify-between">
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
              <span className="text-[11px] text-slate-500">
                Die Unterschrift wird hochauflösend als Vektorgrafik im Sitzungsdatensatz gesichert.
              </span>
              <button
                type="button"
                onClick={handleSaveCurrentSignature}
                disabled={!hasDrawnStroke || isSaving}
                className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  hasDrawnStroke && !isSaving
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Wird gespeichert...' : 'Unterschrift übernehmen'}</span>
              </button>
            </div>
          </div>

          {/* PDF Download Options Section */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              <span>Protokoll-Download Optionen</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleDownloadPdf(true)}
                disabled={Boolean(isExporting) || signatures.length === 0}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between shadow-2xs ${
                  signatures.length > 0
                    ? 'border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 cursor-pointer'
                    : 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                }`}
                title={signatures.length > 0 ? 'Erzeugt PDF mit den hinterlegten digitalen Unterschriften' : 'Erst mindestens eine Unterschrift erfassen'}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-rose-600" />
                    <span>Mit digitaler Unterschrift</span>
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] bg-rose-200/80 text-rose-800 font-bold rounded">
                    {signatures.length}/2 signiert
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Fügt die digitalen Signaturen und Zeitstempel direkt in das Protokoll-PDF ein.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadPdf(false)}
                disabled={Boolean(isExporting)}
                className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition-all flex flex-col justify-between shadow-2xs cursor-pointer"
                title="Erzeugt das Protokoll mit freier Blanko-Signaturzeile zum handschriftlichen Unterzeichnen"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Ohne Unterschrift (Blanko)</span>
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-700 font-bold rounded">
                    Zum Ausdrucken
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Erzeugt das Protokoll mit klassischer Signaturzeile zum manuellen Ausdruck und handschriftlichen Zeichnen.
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Status: {signatures.length === 2 ? 'Beide Unterschriften vollständig erfasst.' : `${signatures.length} von 2 Unterschriften vorhanden.`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
