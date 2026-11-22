import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ALLE_KANTEN,
  begrenze,
  MIN_BREITE,
  MIN_HOEHE,
  leseGespeichert,
  mauszeiger,
  neueGroesse,
  schreibeGespeichert,
  SPEICHER_SCHLUESSEL,
  type Groesse,
  type Kante,
  type Platz
} from '../utils/fenstergroesse';

/**
 * Fenster (Dialog), dessen Größe der Anwender durch Ziehen an den Kanten und
 * Ecken ändern kann (Runde 2, R3). Ersetzt in einem Dialog das `div` des
 * eigentlichen Fensters; der abgedunkelte Hintergrund drumherum bleibt, wie
 * er ist.
 *
 * - Die Größe wird je Fensterart (`kennung`) im Browser gemerkt, nur auf
 *   diesem Gerät und nicht in der Datensicherung.
 * - Angezeigt wird sie immer begrenzt auf den Platz im Programmfenster
 *   (Regeln in `utils/fenstergroesse.ts`). Wird das Programmfenster kleiner,
 *   schrumpft das Fenster mit; der gemerkte Wunsch bleibt erhalten.
 * - Doppelklick auf die Kopfzeile (das erste Element im Fenster, außer auf
 *   Knöpfen und Eingabefeldern) stellt die Ausgangsgröße wieder her.
 * - Ist eine Höhe gesetzt, trägt das Fenster `data-hoehe="fest"`. Der
 *   rollende Inhaltsbereich hebt dann mit der Klasse
 *   `group-data-[hoehe=fest]/fenster:max-h-none` seine eigene Höhengrenze auf
 *   und füllt mit `flex-1 min-h-0` den Platz.
 */
interface Props extends React.HTMLAttributes<HTMLDivElement> {
  /** Name der Fensterart, unter dem die Größe gemerkt wird, z. B. "buchung". */
  kennung: string;
  /** Kanten, an denen gezogen werden kann; Standard: alle. */
  kanten?: Kante[];
  /** Eigene Mindestbreite und -höhe, wenn Kopf- und Fußleisten zusammen mehr Platz brauchen als die üblichen 360 × 240. */
  minBreite?: number;
  minHoehe?: number;
}

function leseWunsch(kennung: string): Groesse {
  try {
    return leseGespeichert(localStorage.getItem(SPEICHER_SCHLUESSEL))[kennung] ?? {};
  } catch {
    return {};
  }
}

function merke(kennung: string, groesse: Groesse | null): void {
  try {
    localStorage.setItem(SPEICHER_SCHLUESSEL, schreibeGespeichert(localStorage.getItem(SPEICHER_SCHLUESSEL), kennung, groesse));
  } catch {
    // Ohne Speicher (z. B. gesperrt) gilt die Größe nur bis zum Schließen.
  }
}

const zahl = (v: string) => parseFloat(v) || 0;

/** Platz im umgebenden Hintergrund: dessen Innenmaß ohne Polster und ohne die Außenabstände des Fensters. */
function messePlatz(el: HTMLElement): Platz {
  const eltern = el.parentElement;
  if (!eltern) return { breite: window.innerWidth - 32, hoehe: window.innerHeight - 32 };
  const p = getComputedStyle(eltern);
  const s = getComputedStyle(el);
  return {
    breite: eltern.clientWidth - zahl(p.paddingLeft) - zahl(p.paddingRight) - zahl(s.marginLeft) - zahl(s.marginRight),
    hoehe: eltern.clientHeight - zahl(p.paddingTop) - zahl(p.paddingBottom) - zahl(s.marginTop) - zahl(s.marginBottom)
  };
}

// Die Ecken sind größer als die Kanten: Die abgerundeten Ecken der Fenster
// schneiden den äußersten Teil ab, greifen lässt sich nur der innere.
const GRIFF_LAGE: Record<Kante, string> = {
  n: 'top-0 left-6 right-6 h-1.5',
  s: 'bottom-0 left-6 right-6 h-1.5',
  e: 'right-0 top-6 bottom-6 w-1.5',
  w: 'left-0 top-6 bottom-6 w-1.5',
  ne: 'top-0 right-0 w-6 h-6',
  nw: 'top-0 left-0 w-6 h-6',
  se: 'bottom-0 right-0 w-6 h-6',
  sw: 'bottom-0 left-0 w-6 h-6'
};

const VeraenderbaresFenster: React.FC<Props> = ({ kennung, kanten = ALLE_KANTEN, minBreite = MIN_BREITE, minHoehe = MIN_HOEHE, className = '', style, onDoubleClick, children, ...rest }) => {
  const ref = useRef<HTMLDivElement>(null);
  const min: Platz = { breite: minBreite, hoehe: minHoehe };
  const [wunsch, setWunsch] = useState<Groesse>(() => leseWunsch(kennung));
  const [platz, setPlatz] = useState<Platz | null>(null);
  const deckeRef = useRef<HTMLDivElement | null>(null);
  const ziehen = useRef<{
    kante: Kante;
    x: number;
    y: number;
    start: Platz;
    faktor: { x: number; y: number };
    platz: Platz;
    min: Platz;
    letzte: Groesse;
  } | null>(null);

  // Platz messen: beim Öffnen und bei jeder Größenänderung des Programmfensters.
  useLayoutEffect(() => {
    const messen = () => {
      if (ref.current) setPlatz(messePlatz(ref.current));
    };
    messen();
    window.addEventListener('resize', messen);
    return () => window.removeEventListener('resize', messen);
  }, []);

  const bewegen = useCallback((e: PointerEvent) => {
    const z = ziehen.current;
    if (!z) return;
    const g = begrenze(neueGroesse(z.start, z.kante, e.clientX - z.x, e.clientY - z.y, z.faktor), z.platz, z.min);
    z.letzte = { ...z.letzte, ...g };
    setWunsch(z.letzte);
  }, []);

  const loslassen = useCallback(() => {
    const z = ziehen.current;
    ziehen.current = null;
    window.removeEventListener('pointermove', bewegen);
    window.removeEventListener('pointerup', loslassen);
    window.removeEventListener('pointercancel', loslassen);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    deckeRef.current?.remove();
    deckeRef.current = null;
    if (z) merke(kennung, z.letzte);
  }, [bewegen, kennung]);

  // Wird das Fenster während des Ziehens geschlossen, nichts hängen lassen.
  useEffect(() => () => loslassen(), [loslassen]);

  const anfassen = (kante: Kante) => (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    // Während des Ziehens liegt eine unsichtbare Fläche über allem. Sonst
    // verschluckt eine eingebettete Ansicht (PDF, Karte), über die die Maus
    // fährt, die Bewegungen, und das Fenster bleibt hängen.
    const decke = document.createElement('div');
    decke.style.cssText = `position:fixed;inset:0;z-index:2147483647;cursor:${mauszeiger(kante)};`;
    document.body.appendChild(decke);
    deckeRef.current = decke;
    const r = el.getBoundingClientRect();
    const eltern = el.parentElement ? getComputedStyle(el.parentElement) : null;
    const aktuellerPlatz = messePlatz(el);
    setPlatz(aktuellerPlatz);
    ziehen.current = {
      kante,
      x: e.clientX,
      y: e.clientY,
      start: { breite: r.width, hoehe: r.height },
      // Mittig stehende Fenster wachsen nach beiden Seiten; dann muss die
      // Größe doppelt so schnell wachsen, damit die Kante der Maus folgt.
      faktor: {
        x: eltern?.justifyContent === 'center' ? 2 : 1,
        y: eltern?.alignItems === 'center' ? 2 : 1
      },
      platz: aktuellerPlatz,
      min,
      letzte: { ...begrenze(wunsch, aktuellerPlatz, min) }
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = mauszeiger(kante);
    window.addEventListener('pointermove', bewegen);
    window.addEventListener('pointerup', loslassen);
    window.addEventListener('pointercancel', loslassen);
  };

  const zuruecksetzen = (e: React.MouseEvent<HTMLDivElement>) => {
    onDoubleClick?.(e);
    const kopf = ref.current?.firstElementChild;
    const ziel = e.target as HTMLElement;
    if (!kopf || !kopf.contains(ziel) || ziel.closest('button, a, input, select, textarea, label')) return;
    setWunsch({});
    merke(kennung, null);
  };

  const angezeigt = platz ? begrenze(wunsch, platz, min) : {};
  const masse: React.CSSProperties = {};
  if (angezeigt.breite !== undefined && platz) {
    masse.width = angezeigt.breite;
    masse.maxWidth = Math.floor(platz.breite);
  }
  if (angezeigt.hoehe !== undefined && platz) {
    masse.height = angezeigt.hoehe;
    masse.maxHeight = Math.floor(platz.hoehe);
  }

  return (
    <div
      {...rest}
      ref={ref}
      className={`${className} group/fenster relative`}
      style={{ ...style, ...masse }}
      data-hoehe={angezeigt.hoehe !== undefined ? 'fest' : undefined}
      onDoubleClick={zuruecksetzen}
    >
      {children}
      {kanten.map(k => (
        <div
          key={k}
          aria-hidden="true"
          className={`absolute z-30 touch-none ${GRIFF_LAGE[k]}`}
          style={{ cursor: mauszeiger(k) }}
          onPointerDown={anfassen(k)}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        />
      ))}
    </div>
  );
};

export default VeraenderbaresFenster;
