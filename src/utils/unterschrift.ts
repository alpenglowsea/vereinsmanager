/**
 * Hinterlegte Unterschrift für Zuwendungsbestätigungen (D-41).
 *
 * Gleiches Format wie die Android-Fassung (`Unterschrift.kt`): in den
 * Vereinsdaten unter `signature` als `{ aspect, strokes }`. `strokes` sind
 * Linienzüge, jeder Punkt `[x, y]` auf 0..1 bezogen (x auf die Breite, y auf
 * die Höhe der Zeichenfläche); `aspect` ist Breite geteilt durch Höhe dieser
 * Fläche. Dadurch lässt sich die Unterschrift beliebig groß zeichnen, und eine
 * am Handy gezeichnete erscheint am Desktop gleich (und umgekehrt).
 */
export interface Unterschrift {
  aspect: number;
  strokes: number[][][];
}

const r4 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;

/** Liest eine gespeicherte Unterschrift; null, wenn keine oder keine brauchbare da ist. */
export function leseUnterschrift(roh: unknown): Unterschrift | null {
  if (typeof roh !== 'object' || roh === null) return null;
  const o = roh as Record<string, unknown>;
  const aspect = Number(o.aspect);
  if (!Number.isFinite(aspect) || aspect <= 0 || !Array.isArray(o.strokes)) return null;
  const strokes = o.strokes
    .filter(Array.isArray)
    .map(st =>
      (st as unknown[])
        .filter((p): p is unknown[] => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
        .map(p => [Number(p[0]), Number(p[1])])
    )
    .filter(st => st.length >= 2);
  return strokes.length > 0 ? { aspect, strokes } : null;
}

/**
 * Aus der Zeichenfläche (Punkte in Pixeln) die speicherbare Form machen.
 * Linienzüge mit weniger als zwei Punkten fallen weg; null, wenn nichts übrig bleibt.
 */
export function unterschriftAusZeichnung(striche: { x: number; y: number }[][], breite: number, hoehe: number): Unterschrift | null {
  if (!(breite > 0) || !(hoehe > 0)) return null;
  const strokes = striche.filter(st => st.length >= 2).map(st => st.map(p => [r4(p.x / breite), r4(p.y / hoehe)]));
  return strokes.length > 0 ? { aspect: breite / hoehe, strokes } : null;
}

/**
 * Linienzüge in mm für den Vordruck: rechts neben Ort und Datum, auf der
 * Linie stehend, höchstens 70 × 11 mm, Seitenverhältnis bleibt (wie Android).
 * `x0`: linker Rand, `grundlinie`: Unterkante.
 */
export function unterschriftImPdf(u: Unterschrift, x0: number, grundlinie: number): number[][][] {
  const hoehe = Math.min(11, 70 / u.aspect);
  const breite = hoehe * u.aspect;
  const y0 = grundlinie - hoehe;
  return u.strokes.map(st => st.map(([x, y]) => [x0 + x * breite, y0 + y * hoehe]));
}
