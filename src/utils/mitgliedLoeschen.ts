/**
 * Was beim Löschen von Mitgliedern mit noch ausgegebenem Material geschieht
 * (Rückmeldung T-352, Gleichstand mit Android `MemberStore.loeschen`):
 *
 * - „zurück“: Jede noch ausgegebene Ausgabe gilt ab heute als zurückgegeben.
 * - „übertragen“: Sie geht auf ein anderes Mitglied über; dieses bekommt einen
 *   Eintrag „Material übernommen von …“ in seine Änderungshistorie.
 *
 * Bereits zurückgegebene Ausgaben bleiben als Verlauf unverändert stehen.
 */
import type { Member, MemberInventoryAssignment } from '../types';

export type MaterialWahl = { art: 'zurueck' } | { art: 'uebertragen'; zielId: string };

/** Noch ausgegebene Gegenstände der Mitglieder. */
export const offenesMaterial = (assignments: MemberInventoryAssignment[], ids: string[]): MemberInventoryAssignment[] => {
  const s = new Set(ids);
  return assignments.filter(a => s.has(a.memberId) && a.status !== 'returned');
};

/** Wer Material übernehmen kann: nicht ausgetreten und nicht selbst unter den gelöschten. Sortiert nach Name. */
export const moeglicheEmpfaenger = (members: Member[], ids: string[]): Member[] => {
  const s = new Set(ids);
  return members
    .filter(m => !s.has(m.id) && m.status !== 'terminated')
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'de'));
};

export interface MaterialErgebnis {
  /** Geänderte Ausgaben (zu speichern). */
  geaendert: MemberInventoryAssignment[];
  zurueckgegeben: number;
  uebertragen: number;
  /** Einträge für die Historie des Empfängers, je gelöschtem Mitglied mit übertragenem Material. */
  protokoll: { memberId: string; summary: string }[];
}

/**
 * Rechnet die Änderungen aus, ohne zu speichern. `heute` als JJJJ-MM-TT, `jetzt` als Zeitstempel.
 * Wirft einen Fehler, wenn das Ziel fehlt oder selbst gelöscht wird.
 */
export function materialBeimLoeschen(
  assignments: MemberInventoryAssignment[],
  geloescht: Member[],
  wahl: MaterialWahl,
  alleMitglieder: Member[],
  heute: string,
  jetzt: string
): MaterialErgebnis {
  const ids = geloescht.map(m => m.id);
  if (wahl.art === 'uebertragen') {
    if (ids.includes(wahl.zielId)) throw new Error('Das Ziel-Mitglied für das Material wird selbst gelöscht.');
    if (!alleMitglieder.some(m => m.id === wahl.zielId)) throw new Error('Das Ziel-Mitglied für das Material gibt es nicht.');
  }
  const ergebnis: MaterialErgebnis = { geaendert: [], zurueckgegeben: 0, uebertragen: 0, protokoll: [] };
  for (const m of geloescht) {
    const offen = offenesMaterial(assignments, [m.id]);
    if (wahl.art === 'zurueck') {
      for (const a of offen) ergebnis.geaendert.push({ ...a, status: 'returned', returnDate: heute, updatedAt: jetzt });
      ergebnis.zurueckgegeben += offen.length;
    } else {
      for (const a of offen) ergebnis.geaendert.push({ ...a, memberId: wahl.zielId, updatedAt: jetzt });
      ergebnis.uebertragen += offen.length;
      if (offen.length > 0) {
        const von = `${m.firstName} ${m.lastName}`.trim();
        ergebnis.protokoll.push({
          memberId: wahl.zielId,
          summary: `Material übernommen von ${von} (${m.memberNumber}): ${offen.length} Gegenstand/Gegenstände`
        });
      }
    }
  }
  return ergebnis;
}
