/**
 * Auswahl in Tabellen mit mehreren Seiten.
 * ---------------------------------------------------------------------------
 *
 * Das Kästchen in der Kopfzeile wirkt nur auf die Zeilen, die gerade auf der
 * aktuellen Seite stehen. Wer wirklich alle Einträge der Tabelle (bzw. alle,
 * die zur aktuellen Suche/Filterung passen) auswählen will, bekommt dazu
 * einen eigenen Knopf in der Auswahlleiste angeboten (siehe
 * AuswahlLeiste.tsx) — wie bei Gmail.
 *
 * Die Auswahl selbst ist eine Menge von Kennungen und bleibt beim Blättern
 * erhalten: Was auf Seite 1 angekreuzt wurde, bleibt es auch auf Seite 2.
 *
 * Diese Datei enthält nur die Rechenlogik (ohne Oberfläche), damit sie sich
 * unabhängig von der Darstellung prüfen lässt.
 */

export interface MitId {
  id: string;
}

export interface SeitenStatus {
  /** Jede Zeile der aktuellen Seite ist ausgewählt (und es gibt Zeilen). */
  seiteKomplett: boolean;
  /** Ein Teil, aber nicht alle Zeilen der aktuellen Seite sind ausgewählt. */
  seiteTeilweise: boolean;
  /** Jeder Eintrag, der zur Suche/Filterung passt, ist ausgewählt. */
  allesKomplett: boolean;
}

export function ermittleSeitenStatus<T extends MitId>(
  ausgewaehlt: ReadonlySet<string>,
  seite: readonly T[],
  alleGefilterten: readonly T[]
): SeitenStatus {
  const aufSeite = seite.filter(e => ausgewaehlt.has(e.id)).length;
  const seiteKomplett = seite.length > 0 && aufSeite === seite.length;
  return {
    seiteKomplett,
    seiteTeilweise: aufSeite > 0 && !seiteKomplett,
    allesKomplett:
      alleGefilterten.length > 0 && alleGefilterten.every(e => ausgewaehlt.has(e.id)),
  };
}

/**
 * Klick auf das Kästchen in der Kopfzeile: Ist die ganze Seite schon
 * ausgewählt, wird sie abgewählt — sonst wird sie ausgewählt. Einträge auf
 * anderen Seiten bleiben dabei unberührt.
 */
export function wechsleSeite<T extends MitId>(
  ausgewaehlt: ReadonlySet<string>,
  seite: readonly T[]
): Set<string> {
  const neu = new Set(ausgewaehlt);
  const komplett = seite.length > 0 && seite.every(e => neu.has(e.id));
  for (const e of seite) {
    if (komplett) neu.delete(e.id);
    else neu.add(e.id);
  }
  return neu;
}

/** Knopf „Alle … auswählen": alle, die zur aktuellen Suche/Filterung passen. */
export function waehleAlleGefilterten<T extends MitId>(
  ausgewaehlt: ReadonlySet<string>,
  alleGefilterten: readonly T[]
): Set<string> {
  const neu = new Set(ausgewaehlt);
  for (const e of alleGefilterten) neu.add(e.id);
  return neu;
}
