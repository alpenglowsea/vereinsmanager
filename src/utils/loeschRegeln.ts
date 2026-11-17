/**
 * Regeln für das Löschen: Was hängt an einem Eintrag, und darf er weg?
 *
 * Vorher löschte die Anwendung an mehreren Stellen ohne Rücksicht auf
 * Verknüpfungen. Zurück blieben Buchungen ohne Konto, Ausgaben von Material,
 * das es nicht mehr gab, und Sparten, die nur noch als Text an Mitgliedern
 * standen. Die Regeln entsprechen der Android-Fassung.
 *
 * Diese Datei enthält nur die Entscheidungen (ohne Datenbank), damit sie sich
 * prüfen lassen; ausgeführt wird in `storage.ts` und in den Masken.
 */
import type { FinancialAccount, InventoryItem, Member, MemberInventoryAssignment, Transaction } from '../types';

// ---------------------------------------------------------------------------
// Beleg einer Buchung
// ---------------------------------------------------------------------------

/**
 * Kennung des Dokuments, das beim Speichern einer Buchung mit Beleg in der
 * Dokumentenverwaltung angelegt wird (siehe `saveTransaction`).
 */
export function belegDokumentId(buchungsId: string): string {
  return `doc-receipt-${buchungsId}`;
}

// ---------------------------------------------------------------------------
// Inventar
// ---------------------------------------------------------------------------

export interface OffeneAusgaben {
  /** Anzahl der Ausgaben, die noch nicht zurückgegeben sind. */
  ausgaben: number;
  /** Stückzahl über diese Ausgaben. */
  stueck: number;
  /** Anzahl verschiedener Mitglieder. */
  mitglieder: number;
}

/** Was ist von einem Gegenstand noch an Mitglieder ausgegeben? */
export function offeneAusgaben(gegenstandId: string, ausgaben: MemberInventoryAssignment[]): OffeneAusgaben {
  const offen = ausgaben.filter(a => a.inventoryItemId === gegenstandId && a.status !== 'returned');
  return {
    ausgaben: offen.length,
    stueck: offen.reduce((summe, a) => summe + (Number(a.quantity) || 0), 0),
    mitglieder: new Set(offen.map(a => a.memberId)).size
  };
}

/** Teilt eine Auswahl in löschbare Gegenstände und solche, die noch ausgegeben sind. */
export function teileInventarAuswahl(
  ids: string[],
  ausgaben: MemberInventoryAssignment[]
): { loeschbar: string[]; gesperrt: string[] } {
  const loeschbar: string[] = [];
  const gesperrt: string[] = [];
  for (const id of ids) {
    (offeneAusgaben(id, ausgaben).ausgaben > 0 ? gesperrt : loeschbar).push(id);
  }
  return { loeschbar, gesperrt };
}

/** Meldung, warum ein Gegenstand nicht gelöscht werden kann. */
export function inventarSperrText(name: string, offen: OffeneAusgaben): string {
  const an = offen.mitglieder === 1 ? 'ein Mitglied' : `${offen.mitglieder} Mitglieder`;
  return `„${name}“ ist noch an ${an} ausgegeben (${offen.stueck} Stück). Bitte zuerst die Rückgabe eintragen oder die Ausgabe löschen.`;
}

// ---------------------------------------------------------------------------
// Konten
// ---------------------------------------------------------------------------

export interface KontoLoeschPlan {
  ok: boolean;
  /** Grund, wenn das Konto so nicht gelöscht werden kann. */
  fehler?: string;
  /** Anzahl der Buchungen, die am Konto hängen. */
  betroffen: number;
  /** Buchungen mit dem neuen Konto; leer, wenn nichts zu übertragen ist oder `ok` falsch ist. */
  geaendert: Transaction[];
}

/** Buchungen, die an einem Konto hängen (als Konto oder als Zielkonto einer Umbuchung). */
export function buchungenAmKonto(kontoId: string, buchungen: Transaction[]): Transaction[] {
  return buchungen.filter(b => b.accountId === kontoId || b.targetAccountId === kontoId);
}

/**
 * Prüft, ob ein Konto gelöscht werden kann, und liefert die Buchungen, die
 * dafür auf ein anderes Konto übertragen werden.
 *
 *  - Es muss mindestens ein Konto übrig bleiben.
 *  - Hängen Buchungen am Konto, muss ein anderes Konto gewählt sein, das sie
 *    übernimmt. Ohne das stünden sie danach ohne Konto da und fielen aus
 *    Kontoständen und Auswertungen.
 *  - Eine Umbuchung darf dadurch nicht zwischen ein und demselben Konto
 *    liegen; dann wird nichts geändert.
 */
export function planeKontoLoeschen(
  kontoId: string,
  konten: FinancialAccount[],
  buchungen: Transaction[],
  uebertragenAuf?: string | null
): KontoLoeschPlan {
  const betroffen = buchungenAmKonto(kontoId, buchungen);
  if (!konten.some(k => k.id === kontoId)) {
    return { ok: false, fehler: 'Das Konto gibt es nicht mehr.', betroffen: betroffen.length, geaendert: [] };
  }
  if (konten.length <= 1) {
    return { ok: false, fehler: 'Es muss mindestens ein Konto bleiben.', betroffen: betroffen.length, geaendert: [] };
  }
  if (betroffen.length === 0) return { ok: true, betroffen: 0, geaendert: [] };

  if (!uebertragenAuf || uebertragenAuf === kontoId || !konten.some(k => k.id === uebertragenAuf)) {
    return {
      ok: false,
      fehler: `An diesem Konto ${betroffen.length === 1 ? 'hängt eine Buchung' : `hängen ${betroffen.length} Buchungen`}. Bitte ein anderes Konto wählen, das sie übernimmt.`,
      betroffen: betroffen.length,
      geaendert: []
    };
  }

  const geaendert: Transaction[] = [];
  for (const b of betroffen) {
    const neuKonto = b.accountId === kontoId ? uebertragenAuf : b.accountId;
    const neuZiel = b.targetAccountId === kontoId ? uebertragenAuf : b.targetAccountId;
    if (b.type === 'transfer' && neuZiel && neuKonto === neuZiel) {
      return {
        ok: false,
        fehler: `Eine Umbuchung (${b.documentNumber || b.date}) läge danach zwischen ein und demselben Konto. Bitte diese Umbuchung zuerst ändern oder löschen, oder ein anderes Konto wählen.`,
        betroffen: betroffen.length,
        geaendert: []
      };
    }
    geaendert.push({ ...b, accountId: neuKonto, targetAccountId: neuZiel });
  }
  return { ok: true, betroffen: betroffen.length, geaendert };
}

// ---------------------------------------------------------------------------
// Sparten / Abteilungen
// ---------------------------------------------------------------------------

export interface SpartenVerwendung {
  mitglieder: number;
  buchungen: number;
  inventar: number;
  gesamt: number;
}

/** Wo wird eine Sparte noch verwendet? Verglichen wird ohne Groß-/Kleinschreibung. */
export function spartenVerwendung(
  sparte: string,
  mitglieder: Pick<Member, 'department'>[],
  buchungen: Pick<Transaction, 'department' | 'splits'>[],
  inventar: Pick<InventoryItem, 'department'>[]
): SpartenVerwendung {
  const gesucht = sparte.trim().toLowerCase();
  const gleich = (wert: string | undefined | null): boolean =>
    typeof wert === 'string' && wert.trim().toLowerCase() === gesucht;
  const m = mitglieder.filter(x => gleich(x.department)).length;
  const b = buchungen.filter(x => gleich(x.department) || (x.splits ?? []).some(s => gleich(s.department))).length;
  const i = inventar.filter(x => gleich(x.department)).length;
  return { mitglieder: m, buchungen: b, inventar: i, gesamt: m + b + i };
}

/** Meldung, warum eine Sparte nicht gelöscht werden kann. */
export function spartenSperrText(sparte: string, v: SpartenVerwendung): string {
  const teile: string[] = [];
  if (v.mitglieder > 0) teile.push(v.mitglieder === 1 ? '1 Mitglied' : `${v.mitglieder} Mitglieder`);
  if (v.buchungen > 0) teile.push(v.buchungen === 1 ? '1 Buchung' : `${v.buchungen} Buchungen`);
  if (v.inventar > 0) teile.push(v.inventar === 1 ? '1 Inventargegenstand' : `${v.inventar} Inventargegenstände`);
  return `Die Sparte „${sparte}“ wird noch verwendet (${teile.join(', ')}) und kann deshalb nicht gelöscht werden. Bitte die Einträge zuerst einer anderen Sparte zuordnen.`;
}
