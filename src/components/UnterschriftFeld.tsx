/**
 * Unterschrift für Zuwendungsbestätigungen hinterlegen (D-41, wie Android).
 *
 * Gezeichnet wird mit Maus, Stift oder Finger. Gespeichert werden keine
 * Bilder, sondern die Linienzüge (siehe `utils/unterschrift.ts`), damit die
 * Unterschrift im PDF scharf bleibt und am Handy dasselbe Format gilt.
 */
import React, { useRef, useState } from 'react';
import { PenTool, Trash2 } from 'lucide-react';
import { Unterschrift, leseUnterschrift, unterschriftAusZeichnung } from '../utils/unterschrift';

const Vorschau: React.FC<{ u: Unterschrift }> = ({ u }) => (
  <svg
    viewBox={`0 0 ${u.aspect} 1`}
    preserveAspectRatio="xMidYMid meet"
    className="w-full h-16"
    aria-label="Hinterlegte Unterschrift"
  >
    {u.strokes.map((st, i) => (
      <polyline
        key={i}
        points={st.map(([x, y]) => `${x * u.aspect},${y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    ))}
  </svg>
);

const Zeichenflaeche: React.FC<{ onUebernehmen: (u: Unterschrift) => void; onAbbrechen: () => void }> = ({
  onUebernehmen,
  onAbbrechen
}) => {
  const flaeche = useRef<HTMLDivElement | null>(null);
  const [striche, setStriche] = useState<{ x: number; y: number }[][]>([]);
  const zeichnet = useRef(false);

  const punkt = (e: React.PointerEvent) => {
    const r = flaeche.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const uebernehmen = () => {
    const r = flaeche.current?.getBoundingClientRect();
    const u = r ? unterschriftAusZeichnung(striche, r.width, r.height) : null;
    if (u) onUebernehmen(u);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Unterschrift zeichnen</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Mit Maus, Stift oder Finger im weißen Feld unterschreiben.
          </p>
        </div>
        <div
          ref={flaeche}
          className="relative h-44 w-full bg-white border border-slate-300 rounded-xl touch-none cursor-crosshair select-none"
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId);
            zeichnet.current = true;
            setStriche(prev => [...prev, [punkt(e)]]);
          }}
          onPointerMove={e => {
            if (!zeichnet.current) return;
            const p = punkt(e);
            setStriche(prev => {
              const kopie = prev.slice();
              kopie[kopie.length - 1] = [...kopie[kopie.length - 1], p];
              return kopie;
            });
          }}
          onPointerUp={() => {
            zeichnet.current = false;
          }}
          onPointerCancel={() => {
            zeichnet.current = false;
          }}
        >
          <svg className="absolute inset-0 w-full h-full text-slate-900">
            {striche.map((st, i) => (
              <polyline
                key={i}
                points={st.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        </div>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5">
          <button
            type="button"
            onClick={onAbbrechen}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => setStriche([])}
            disabled={striche.length === 0}
            className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 rounded-xl text-xs font-bold disabled:opacity-40"
          >
            Neu beginnen
          </button>
          <button
            type="button"
            onClick={uebernehmen}
            disabled={!striche.some(st => st.length >= 2)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-40"
          >
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
};

export const UnterschriftFeld: React.FC<{
  wert: unknown;
  onChange: (u: Unterschrift | undefined) => void;
}> = ({ wert, onChange }) => {
  const [zeichnen, setZeichnen] = useState(false);
  const u = leseUnterschrift(wert);
  return (
    <div className="space-y-3">
      <div className="h-20 flex items-center justify-center bg-white border border-dashed border-slate-300 dark:border-slate-600 rounded-xl px-3 text-slate-900">
        {u ? <Vorschau u={u} /> : <span className="text-xs text-slate-400">Keine Unterschrift hinterlegt</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setZeichnen(true)}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>{u ? 'Neu zeichnen' : 'Unterschrift zeichnen'}</span>
        </button>
        {u && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Entfernen</span>
          </button>
        )}
      </div>
      {zeichnen && (
        <Zeichenflaeche
          onAbbrechen={() => setZeichnen(false)}
          onUebernehmen={neu => {
            onChange(neu);
            setZeichnen(false);
          }}
        />
      )}
    </div>
  );
};
