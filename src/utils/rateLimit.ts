/**
 * Ratenbegrenzung für die Server-Schnittstellen.
 *
 * Warum das nötig ist: Die /api-Endpunkte verlangen keine Anmeldung. Wer
 * die Adresse eines im Internet erreichbaren VereinsManager-Servers kennt,
 * kann sie unbegrenzt aufrufen — und dabei den KI-Schlüssel des Vereins
 * verbrauchen (der kostet Geld) oder über dessen Postfach E-Mails
 * verschicken (das kostet den guten Ruf). Diese Bremse macht daraus einen
 * überschaubaren Schaden.
 *
 * Bewusst ohne Zusatzpaket und ohne Datenbank: Die Zähler liegen im
 * Arbeitsspeicher des Servers. Das genügt für den Betrieb, für den diese
 * Software gedacht ist — ein Container, ein Verein. Die Grenzen dieser
 * Entscheidung, offen benannt:
 *
 *   - Ein Neustart des Servers setzt alle Zähler zurück.
 *   - Liefen mehrere Server nebeneinander (Lastverteilung), zählte jeder
 *     für sich, und die tatsächliche Grenze wäre entsprechend höher.
 *
 * Für beides bräuchte es einen gemeinsamen Speicher wie Redis. Das wäre
 * ein zweiter Dienst, den jeder Verein mitbetreiben müsste — dafür ist der
 * Gewinn zu klein.
 */

export interface RateLimitResult {
  /** Darf der Aufruf durchgelassen werden? */
  allowed: boolean;
  /** Wie viele Aufrufe im laufenden Zeitfenster noch übrig sind. */
  remaining: number;
  /** Sekunden bis zum nächsten freien Versuch. Nur gesetzt, wenn gesperrt. */
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  /** Erlaubte Aufrufe je Zeitfenster. */
  limit: number;
  /** Länge des Zeitfensters in Millisekunden. */
  windowMs: number;
  /**
   * Obergrenze für die Anzahl gleichzeitig beobachteter Absender. Ohne sie
   * könnte ein Angreifer mit vielen verschiedenen Adressen den Speicher des
   * Servers volllaufen lassen — die Bremse wäre dann selbst das Leck.
   */
  maxTrackedKeys?: number;
}

const DEFAULT_MAX_TRACKED_KEYS = 10_000;

/**
 * Gleitendes Zeitfenster: Gezählt werden die Zeitpunkte der letzten
 * Aufrufe, nicht Treffer in einem festen Raster. Ein festes Raster hätte
 * eine bekannte Schwäche — wer seine Aufrufe um den Stundenwechsel herum
 * legt, käme auf das Doppelte durch.
 */
export class RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxTrackedKeys: number;
  private readonly hits = new Map<string, number[]>();

  constructor(options: RateLimitOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.maxTrackedKeys = options.maxTrackedKeys ?? DEFAULT_MAX_TRACKED_KEYS;
  }

  /**
   * Einen Aufruf prüfen und, wenn erlaubt, mitzählen.
   *
   * @param key   Kennung des Absenders, üblicherweise die IP-Adresse.
   * @param now   Zeitpunkt in Millisekunden. Als Parameter, damit sich das
   *              Verhalten über Stunden hinweg prüfen lässt, ohne Stunden
   *              zu warten.
   */
  check(key: string, now: number = Date.now()): RateLimitResult {
    const grenze = now - this.windowMs;
    const bisher = this.hits.get(key) ?? [];

    // Alles, was älter als das Zeitfenster ist, zählt nicht mehr mit.
    const aktuell = bisher.filter(t => t > grenze);

    if (aktuell.length >= this.limit) {
      this.hits.set(key, aktuell);
      // Der älteste noch zählende Aufruf bestimmt, wann wieder Platz ist.
      const frei = aktuell[0] + this.windowMs;
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((frei - now) / 1000)),
      };
    }

    aktuell.push(now);
    this.hits.set(key, aktuell);
    this.aufraeumen(now);

    return {
      allowed: true,
      remaining: this.limit - aktuell.length,
      retryAfterSeconds: 0,
    };
  }

  /** Wie viele Absender gerade beobachtet werden. Für Tests und Diagnose. */
  size(): number {
    return this.hits.size;
  }

  /**
   * Abgelaufene Einträge entfernen. Läuft bei jedem Aufruf mit, prüft aber
   * nur dann alle Einträge, wenn die Obergrenze erreicht ist — sonst wäre
   * jeder einzelne Aufruf unnötig teuer.
   */
  private aufraeumen(now: number): void {
    if (this.hits.size <= this.maxTrackedKeys) return;
    const grenze = now - this.windowMs;
    for (const [key, zeiten] of this.hits) {
      if (zeiten.length === 0 || zeiten[zeiten.length - 1] <= grenze) {
        this.hits.delete(key);
      }
    }
    // Sind danach immer noch zu viele übrig, greift ein Angriff mit vielen
    // Adressen. Dann werden die ältesten verworfen: Lieber ein paar
    // Angreifer wieder freigeben als dem Server den Speicher nehmen.
    if (this.hits.size > this.maxTrackedKeys) {
      const sortiert = [...this.hits.entries()].sort(
        (a, b) => (a[1][a[1].length - 1] ?? 0) - (b[1][b[1].length - 1] ?? 0)
      );
      const zuViel = this.hits.size - this.maxTrackedKeys;
      for (let i = 0; i < zuViel; i++) this.hits.delete(sortiert[i][0]);
    }
  }
}
