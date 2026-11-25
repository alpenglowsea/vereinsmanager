/**
 * Beitragsvorgaben je Mitgliedsart (D-94).
 *
 * Der Verein legt in den Einstellungen fest, welchen Beitrag und welche
 * Zahlweise eine Mitgliedsart standardmäßig hat. Gespeichert in den
 * Vereinsdaten unter `membershipFeeDefaults`
 * (`{ full: { amount: 18, period: 'monthly' }, … }`), so wie die
 * Android-Fassung es liest und schreibt (`AntragEinstellungenStore`).
 *
 * Verwendet wird es beim Anlegen eines neuen Mitglieds (Desktop, Wunsch
 * Johannes 18.11.2026) und bei der Aufnahme neuer Mitglieder (P29).
 */
import type { FeePeriod, MembershipType } from '../types';
import { MitgliedsArt, STANDARD_ARTEN, aktiveArten } from './mitgliedsarten';

/** Kennung einer Mitgliedsart (seit 25.11.2026 frei, siehe utils/mitgliedsarten). */
export type VorgabeArt = string;
export type VorgabePeriode = Exclude<FeePeriod, 'none'>;

export interface BeitragsVorgabe {
  amount: number;
  period: VorgabePeriode;
}

export type BeitragsVorgaben = Record<VorgabeArt, BeitragsVorgabe>;

/** Die Arten mit Vorgabe: alle nicht gelöschten, nicht beitragsfreien, in der Reihenfolge der Liste. */
export const vorgabeArten = (arten: readonly MitgliedsArt[] = STANDARD_ARTEN) => aktiveArten(arten).filter(a => !a.beitragsfrei);

export const VORGABE_PERIODEN: { period: VorgabePeriode; label: string }[] = [
  { period: 'monthly', label: 'monatlich' },
  { period: 'quarterly', label: 'vierteljährlich' },
  { period: 'half_yearly', label: 'halbjährlich' },
  { period: 'yearly', label: 'jährlich' }
];

/** Startwerte wie in der Android-Fassung. Eine neu angelegte Art beginnt mit 0 € monatlich. */
export const STANDARD_VORGABEN: BeitragsVorgaben = {
  full: { amount: 18, period: 'monthly' },
  reduced: { amount: 12, period: 'monthly' },
  youth: { amount: 10, period: 'monthly' },
  family: { amount: 30, period: 'monthly' },
  supporting: { amount: 25, period: 'monthly' }
};

const PERIODEN = new Set<string>(VORGABE_PERIODEN.map(p => p.period));

function betragAus(roh: unknown): number | null {
  const n = typeof roh === 'number' ? roh : Number.parseFloat(String(roh ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/**
 * Liest die gespeicherten Vorgaben für alle Arten mit Vorgabe; Fehlendes oder
 * Unbrauchbares wird mit den Startwerten ergänzt (wie Android).
 */
export function leseVorgaben(roh: unknown, arten: readonly MitgliedsArt[] = STANDARD_ARTEN): BeitragsVorgaben {
  const quelle = (typeof roh === 'object' && roh !== null ? roh : {}) as Record<string, unknown>;
  const ergebnis = {} as BeitragsVorgaben;
  for (const { id: art } of vorgabeArten(arten)) {
    const eintrag = (typeof quelle[art] === 'object' && quelle[art] !== null ? quelle[art] : {}) as Record<string, unknown>;
    const betrag = betragAus(eintrag.amount);
    const periode = typeof eintrag.period === 'string' && PERIODEN.has(eintrag.period) ? (eintrag.period as VorgabePeriode) : null;
    const start = STANDARD_VORGABEN[art] ?? { amount: 0, period: 'monthly' as VorgabePeriode };
    ergebnis[art] = {
      amount: betrag ?? start.amount,
      period: periode ?? start.period
    };
  }
  return ergebnis;
}

/** Vorgabe für eine Mitgliedsart; null bei Arten ohne Vorgabe (beitragsfrei, gelöscht, ausgetreten). */
export function vorgabeFuer(vorgaben: BeitragsVorgaben, art: MembershipType): BeitragsVorgabe | null {
  return Object.prototype.hasOwnProperty.call(vorgaben, art) ? vorgaben[art] : null;
}
