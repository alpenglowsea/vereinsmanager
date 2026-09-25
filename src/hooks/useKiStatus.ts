/**
 * Ist die KI einsatzbereit?
 * ---------------------------------------------------------------------------
 *
 * Diese Frage stellen sechs verschiedene Masken — Buchungsvorschlag,
 * Belegerkennung, Antragsübernahme, Notizen- und Tonauswertung,
 * Entwurfshilfe. Sie alle sollen ihre KI-Knöpfe ausgrauen, solange die
 * Nutzung nicht freigegeben ist.
 *
 * Jede Maske einzeln nachfragen zu lassen, hieße: sechs Anfragen an den Server
 * beim Öffnen eines Dialogs, und bei jedem erneuten Öffnen wieder. Deshalb
 * wird die Antwort hier einmal geholt und geteilt.
 *
 * Warum nicht einfach ein React-Context? Weil er durch die halbe Anwendung
 * gereicht werden müsste, an Stellen vorbei, die mit KI nichts zu tun haben.
 * Ein Modul mit einem kleinen Verteiler ist hier das kleinere Übel: Die Masken
 * rufen einen Haken auf, sonst ändert sich nichts.
 *
 * Die Sperre selbst sitzt NICHT hier. Der Server weist jeden KI-Aufruf ab,
 * solange nichts freigegeben ist (src/server/instanceConfig.ts). Was hier
 * passiert, ist reine Höflichkeit gegenüber dem Anwender: Ein Knopf, der
 * ohnehin nichts bewirkt, soll das vorher sagen und nicht erst hinterher.
 */

import { useEffect, useState } from 'react';
import { AiConfigService } from '../services/aiConfigService';

/** Was die Masken wissen müssen. */
export interface KiStatus {
  /** Darf und kann die KI arbeiten? Nur darauf kommt es an. */
  einsatzbereit: boolean;
  /** Ist ein Schlüssel hinterlegt, aber die Freigabe fehlt? */
  nurFreigabeFehlt: boolean;
  /** Noch nicht vom Server geholt — dann noch nichts ausgrauen. */
  geladen: boolean;
}

const UNBEKANNT: KiStatus = { einsatzbereit: false, nurFreigabeFehlt: false, geladen: false };

let stand: KiStatus = UNBEKANNT;
let laeuft: Promise<void> | null = null;
const zuhoerer = new Set<(neu: KiStatus) => void>();

function verteile(neu: KiStatus): void {
  stand = neu;
  for (const melde of zuhoerer) melde(neu);
}

async function hole(): Promise<void> {
  const konfiguration = await AiConfigService.load();
  if (!konfiguration) {
    // Server nicht erreichbar. Dann ist die KI auch nicht einsatzbereit —
    // sie läuft ohnehin über ihn. "geladen" wird trotzdem gesetzt, sonst
    // bliebe die Maske für immer im Zustand "weiß noch nicht".
    verteile({ einsatzbereit: false, nurFreigabeFehlt: false, geladen: true });
    return;
  }
  verteile({
    einsatzbereit: konfiguration.einsatzbereit,
    nurFreigabeFehlt: konfiguration.configured && !konfiguration.aktiviert,
    geladen: true,
  });
}

/**
 * Holt den Stand neu. Die Einstellungsmaske ruft das auf, nachdem jemand die
 * Freigabe erteilt oder zurückgenommen hat — sonst zeigten die Knöpfe in den
 * anderen Masken bis zum nächsten Neuladen den alten Zustand.
 */
export function kiStatusNeuLaden(): void {
  laeuft = hole().finally(() => {
    laeuft = null;
  });
}

/**
 * Liefert den Stand. Beim ersten Aufruf wird er einmal geholt; alle weiteren
 * Masken bekommen ihn ohne zusätzliche Anfrage.
 */
export function useKiStatus(): KiStatus {
  const [aktuell, setAktuell] = useState<KiStatus>(stand);

  useEffect(() => {
    zuhoerer.add(setAktuell);
    if (!stand.geladen && !laeuft) {
      laeuft = hole().finally(() => {
        laeuft = null;
      });
    }
    return () => {
      zuhoerer.delete(setAktuell);
    };
  }, []);

  return aktuell;
}
