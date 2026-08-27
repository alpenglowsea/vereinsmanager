import React, { useRef, useState, useEffect, useCallback } from 'react';
import { RotateCcw, CheckCircle2, PenTool, Eraser } from 'lucide-react';

interface DigitalSignaturePadProps {
  id?: string;
  label: string;
  sublabel?: string;
  value?: string; // Base64 data URL
  onChange: (dataUrl: string | undefined) => void;
  required?: boolean;
  signerName?: string;
  className?: string;
}

export const DigitalSignaturePad: React.FC<DigitalSignaturePadProps> = ({
  id = 'signature-pad',
  label,
  sublabel = 'Mit Finger (Smartphone/Tablet) oder Maus (PC) im Kasten unterschreiben',
  value,
  onChange,
  required = false,
  signerName,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(Boolean(value));
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Canvas-Größe und DPI-Skalierung initialisieren
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(rect.width, 280);
    const height = 150;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#0f172a'; // Deep Slate Ink

    // Falls ein bestehender Wert vorliegt, rendern
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
      };
      img.src = value;
      setHasDrawn(true);
    }
  }, [value]);

  useEffect(() => {
    setupCanvas();

    const handleResize = () => {
      // Re-setup nur wenn noch nicht gezeichnet oder nach Bestätigung
      if (!hasDrawn) {
        setupCanvas();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvas, hasDrawn]);

  // Koordinaten aus Event ermitteln
  const getCoordinates = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    } else {
      return null;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e) {
      // Touch-Scrollen während des Unterschreibens verhindern
      if (e.cancelable) e.preventDefault();
    }
    const coords = getCoordinates(e.nativeEvent);
    if (!coords) return;

    setIsDrawing(true);
    lastPointRef.current = coords;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 1, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if ('touches' in e && e.cancelable) {
      e.preventDefault();
    }

    const coords = getCoordinates(e.nativeEvent);
    if (!coords || !lastPointRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPointRef.current = coords;
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPointRef.current = null;

    const canvas = canvasRef.current;
    if (canvas && hasDrawn) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawn(false);
    onChange(undefined);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-blue-600" />
          <span>{label}</span>
          {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
        {hasDrawn && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Unterschrieben
          </span>
        )}
      </div>

      <p className="text-[11px] text-slate-500">{sublabel}</p>

      {/* Signature Canvas Box */}
      <div
        ref={containerRef}
        className={`relative w-full rounded-xl border-2 transition-all overflow-hidden bg-white shadow-2xs ${
          hasDrawn
            ? 'border-blue-300 bg-slate-50/40'
            : isDrawing
            ? 'border-blue-500 ring-2 ring-blue-100'
            : 'border-dashed border-slate-300 hover:border-slate-400'
        }`}
        style={{ touchAction: 'none' }}
      >
        <canvas
          id={id}
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair w-full block"
          style={{ height: '150px' }}
        />

        {/* Baseline / Guide line */}
        <div className="absolute bottom-6 left-6 right-6 border-b border-slate-200 pointer-events-none flex items-center justify-between text-[10px] text-slate-400">
          <span>✕ Unterschrift hier platzieren</span>
          {signerName && <span>{signerName}</span>}
        </div>

        {/* Action button inside canvas bottom right */}
        {hasDrawn && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 inline-flex items-center gap-1 px-2.5 py-1 bg-white/90 hover:bg-white text-slate-700 hover:text-rose-600 text-2xs font-semibold rounded-lg border border-slate-200 shadow-xs backdrop-blur-xs transition-colors cursor-pointer"
            title="Unterschrift löschen und neu zeichnen"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Neu unterschreiben</span>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-2xs text-slate-400 px-1">
        <span>Datum: {new Date().toLocaleDateString('de-DE')}</span>
        <span>Rechtsverbindliche digitale Signatur gem. eIDAS</span>
      </div>
    </div>
  );
};
