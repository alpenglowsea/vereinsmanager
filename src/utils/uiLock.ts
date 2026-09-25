/**
 * Darstellung gesperrter Bedienelemente.
 *
 * Grundsatz: Knöpfe bleiben an ihrem Platz, werden aber ausgegraut. Ein
 * Knopf, der verschwindet, lässt die Maske je nach Benutzer anders aussehen
 * — wer danach am Telefon beschreibt, wo etwas steht, redet aneinander
 * vorbei. Ein ausgegrauter Knopf zeigt dagegen: Die Stelle ist richtig, nur
 * das Recht fehlt.
 *
 * Absichtlich NICHT das HTML-Attribut `disabled`: Ein abgeschaltetes
 * Element nimmt keine Mausereignisse an, deshalb zeigen die Browser dort
 * auch keinen Hinweistext an — und auf dem Tablet gibt es ohnehin kein
 * Überfahren mit der Maus. Die Knöpfe bleiben also anklickbar und melden
 * beim Klick, woran es liegt. Gespeichert wird trotzdem nichts: Das
 * verhindert die Prüfung in App.tsx, nicht der Knopf.
 */

/** Hinweis beim Überfahren eines gesperrten Knopfes. */
export const LOCK_TITLE = 'Sie haben für diesen Bereich nur Leserecht';

/** Ausgrauen. Wird an die vorhandenen Klassen des Knopfes angehängt. */
export const lockClass = (allowed: boolean): string =>
  allowed ? '' : ' opacity-40 grayscale cursor-not-allowed';

/** Hinweistext statt der üblichen Beschriftung, solange gesperrt. */
export const lockTitle = (allowed: boolean, normal?: string): string | undefined =>
  allowed ? normal : LOCK_TITLE;

/**
 * Dasselbe fuer die KI-Funktionen.
 *
 * Bewusst ein eigener Hinweistext statt LOCK_TITLE: "Sie haben nur Leserecht"
 * und "die KI ist nicht freigegeben" sind zwei verschiedene Zustaende. Wer den
 * falschen Satz liest, sucht an der falschen Stelle — beim Rechtesystem statt
 * in den Einstellungen.
 */
export const KI_AUS_TITLE =
  'Die KI-Funktionen sind nicht freigegeben (Einstellungen → Allgemein → KI-Assistent)';

/** Ausgrauen, wenn die KI nicht einsatzbereit ist. */
export const kiClass = (einsatzbereit: boolean): string =>
  einsatzbereit ? '' : ' opacity-40 grayscale cursor-not-allowed';

/** Hinweistext statt der üblichen Beschriftung, solange die KI aus ist. */
export const kiTitle = (einsatzbereit: boolean, normal?: string): string | undefined =>
  einsatzbereit ? normal : KI_AUS_TITLE;
