/**
 * Vergleiche für Tabellen, die nach Datum und Belegnummer sortieren.
 *
 * Belegnummern wie „ZB-2026-009“ und „ZB-2026-010“ werden „natürlich“
 * verglichen: Zahlen in der Nummer zählen als Zahlen, nicht als Text. So steht
 * „RE-2026-9“ vor „RE-2026-10“, auch wenn die Nummer einmal ohne führende
 * Nullen vergeben wurde.
 */

const sammler = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

/** Vergleicht zwei Belegnummern natürlich (Zahlen als Zahlen). Leere Nummern stehen zuletzt. */
export function vergleicheNummern(a: string | null | undefined, b: string | null | undefined): number {
  const x = (a ?? '').trim();
  const y = (b ?? '').trim();
  if (x === '' && y === '') return 0;
  if (x === '') return 1;
  if (y === '') return -1;
  return sammler.compare(x, y);
}

/** Zeitpunkt eines Datums (YYYY-MM-DD oder ISO); ungültige und leere Daten zählen als 0. */
function zeit(datum: string | null | undefined): number {
  if (!datum) return 0;
  const t = new Date(datum).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Sortierung „nach Datum“: erst das Datum, bei gleichem Datum die
 * Belegnummer. Ohne den zweiten Schritt stünden Belege desselben Tages in
 * zufälliger Reihenfolge, etwa ZB-2026-012 vor ZB-2026-011.
 */
export function vergleicheDatumDannNummer(
  a: { datum?: string | null; nummer?: string | null },
  b: { datum?: string | null; nummer?: string | null }
): number {
  return zeit(a.datum) - zeit(b.datum) || vergleicheNummern(a.nummer, b.nummer);
}

/** Sortierung „nach Nummer“: erst die Nummer, bei gleicher Nummer das Datum. */
export function vergleicheNummerDannDatum(
  a: { datum?: string | null; nummer?: string | null },
  b: { datum?: string | null; nummer?: string | null }
): number {
  return vergleicheNummern(a.nummer, b.nummer) || zeit(a.datum) - zeit(b.datum);
}
