/**
 * Verbuchen eines SEPA-Beitragslaufs (D-02, D-22), wie die Android-Fassung:
 * Konto 40000 „Echte Mitgliedsbeiträge (laufend)“ im Nummernkreis 40000,
 * ideeller Bereich, ohne Umsatzsteuer; Belegnummer
 * `SEPA-<Jahr>-<Monat oder RUN>-<Mitgliedsnr.>`, eindeutig (bei Kollision -2, -3 …).
 * Vorher stand nur die Kategorie „Mitgliedsbeiträge“ ohne Konto an der
 * Buchung, und ein zweiter Lauf im selben Monat erzeugte dieselben Nummern.
 */
import type { SepaRunHistory, Transaction } from '../types';
import { SKR42_STRUCTURE } from '../data/taxSpheres';
import { kontoText, standardKonto } from '../utils/kontenrahmen';

/** Ursprüngliche Nummer; hat der Verein das Konto umnummeriert, wird auf die neue gebucht (`standardKonto`). */
export const BEITRAGS_KONTO_CODE = '40000';

export function beitragsKonto(): { mainCategory: string; subCategory: string; skrAccount: string } {
  const k = standardKonto(BEITRAGS_KONTO_CODE, SKR42_STRUCTURE);
  if (!k || k.main.type !== 'income') return { mainCategory: '', subCategory: '', skrAccount: BEITRAGS_KONTO_CODE };
  return { mainCategory: kontoText(k.main.code, k.main.name), subCategory: k.sub.label, skrAccount: k.sub.code };
}

/** Die zu verbuchenden Posten: ausgewählt, gültig, Betrag über 0. */
export function verbuchbarePosten(run: Pick<SepaRunHistory, 'items'>) {
  return run.items.filter(i => i.selected && i.isValid && i.amount > 0);
}

/** Eine Einnahme je Posten; `vergeben` sind die schon vorhandenen Belegnummern. */
export function beitragsBuchungen(
  run: SepaRunHistory,
  kontoId: string,
  vergeben: Iterable<string>,
  jetzt: string,
  neueId: (memberNumber: string) => string
): Transaction[] {
  const belegt = new Set(Array.from(vergeben, v => (v || '').trim()));
  const k = beitragsKonto();
  const zeitraum = run.targetMonth ? String(run.targetMonth).padStart(2, '0') : 'RUN';
  return verbuchbarePosten(run).map(item => {
    const grund = `SEPA-${run.targetYear}-${zeitraum}-${item.memberNumber}`;
    let nr = grund;
    let n = 2;
    while (belegt.has(nr)) nr = `${grund}-${n++}`;
    belegt.add(nr);
    return {
      id: neueId(item.memberNumber),
      date: run.executionDate,
      amount: Math.round(item.amount * 100) / 100,
      type: 'income',
      accountId: kontoId,
      documentNumber: nr,
      bookingText: item.remittanceInfo,
      partner: item.accountHolder || item.memberName,
      sphere: 'ideell',
      department: item.department || undefined,
      mainCategory: k.mainCategory,
      subCategory: k.subCategory,
      skrAccount: k.skrAccount,
      category: k.subCategory,
      vatRate: 0,
      notes: `Automatische Verbuchung aus SEPA-Beitragslauf "${run.title}" (Mandat: ${item.mandateReference}, IBAN: ${item.iban.slice(0, 6)}...${item.iban.slice(-4)})`,
      createdAt: jetzt,
      updatedAt: jetzt
    };
  });
}

/**
 * Mitglieder, die in diesem Lauf mit einer Erstlastschrift eingezogen wurden.
 * Nach dem Verbuchen bietet die App an, sie auf Folgelastschrift umzustellen
 * (D-22, nur auf Ja des Anwenders, wie Android).
 */
export function erstlastschriftMitglieder(run: Pick<SepaRunHistory, 'items'>): string[] {
  return verbuchbarePosten(run)
    .filter(i => i.sequenceType === 'FRST')
    .map(i => i.memberId);
}
