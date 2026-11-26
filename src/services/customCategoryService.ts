import { Skr42MainCategory, Skr42SubCategory, Transaction } from '../types';
import { SKR42_STRUCTURE } from '../data/taxSpheres';
import { notifySkr42Changed } from '../data/skr42Store';
import {
  type EigeneKonten, type Skr42Anpassungen, type KontoAnpassung, type NummernkreisAnpassung, type Steuersatz,
  leseEigeneKonten, leseAnpassungen, wirksamerKontenrahmen, ergaenzeAnpassungen, ergaenzeEigene, pruefeNeueNummer,
  pruefeBezeichnung, kontoText, kontoVerwendungen, nummernkreisVerwendungen, buchungenAngleichen, planeAenderung, schluessel,
} from '../utils/kontenrahmen';

/**
 * Der Kontenrahmen des Vereins am Desktop: eigene Nummernkreise und Konten, Anpassungen (Nummer, Bezeichnung,
 * Steuersatz, ausgeblendet). Die Regeln stehen in `src/utils/kontenrahmen.ts` (wortgleich am Handy).
 *
 * Gespeichert in der Datenbank, im Bereich der Einstellungen unter der Kennung `kontenrahmen` (neben `main`). Getrennt
 * von den Vereinsstammdaten, damit ein Speichern der Stammdaten mit einem älteren Stand die Konten nicht überschreibt.
 *
 * Bis 26.11.2026 lagen die eigenen Konten im Browserspeicher des Fensters (localStorage), außerhalb der Datenbank.
 * Unter Linux ging dabei ein frisch angelegtes Konto verloren, als das Fenster direkt nach dem Speichern neu startete.
 * Beim ersten Start mit dieser Fassung zieht der Bestand von dort in die Datenbank um (`laden`).
 *
 * `SKR42_STRUCTURE` bleibt das Array, das die ganze App liest. Es wird bei jeder Änderung aus der mitgelieferten Liste,
 * den eigenen Konten und den Anpassungen neu zusammengesetzt (an Ort und Stelle, damit alle, die es halten, den neuen
 * Stand sehen), aufsteigend nach der Nummer sortiert, und `notifySkr42Changed()` meldet es den Masken.
 */

const ALTER_SCHLUESSEL = 'vm_custom_skr42_accounts';

export interface CustomSubAccountInput {
  mainCatIdOrCode: string;
  code: string;
  name: string;
  vatRateDefault?: Steuersatz;
}

export interface CustomMainAccountInput {
  code: string;
  name: string;
  type: 'income' | 'expense';
  initialSubAccount?: { code?: string; name?: string; vatRateDefault?: Steuersatz };
}

/** Wie der Dienst an die Datenbank kommt; `storage.ts` verbindet ihn beim Laden (vermeidet einen Ring der Importe). */
export interface KontenrahmenSpeicher {
  lesen(): Promise<{ customSkr42Accounts?: unknown; skr42Anpassungen?: unknown } | null>;
  schreiben(daten: { customSkr42Accounts: EigeneKonten; skr42Anpassungen: Skr42Anpassungen }): Promise<void>;
  buchungen(): Promise<Transaction[]>;
  buchungenSpeichern(buchungen: Transaction[]): Promise<void>;
}

function ohne<T>(eintraege: Record<string, T>, schluessel: string): Record<string, T> {
  const kopie = { ...eintraege };
  delete kopie[schluessel];
  return kopie;
}

function alterBrowserspeicher(): unknown {
  try {
    if (typeof localStorage === 'undefined') return null;
    const roh = localStorage.getItem(ALTER_SCHLUESSEL);
    return roh ? JSON.parse(roh) : null;
  } catch {
    return null;
  }
}

class CustomCategoryService {
  /** Die mitgelieferte Liste, unverändert (Kopie vom Programmstart, bevor irgendetwas eingemischt wurde). */
  private readonly standard: Skr42MainCategory[] = SKR42_STRUCTURE.map(m => ({
    ...m,
    subCategories: m.subCategories.map(s => ({ ...s })),
  }));
  private eigene: EigeneKonten;
  private anpassungen: Skr42Anpassungen = { nummernkreise: {}, konten: {} };
  private speicher: KontenrahmenSpeicher | null = null;

  constructor() {
    // Bis die Datenbank gelesen ist (`laden`), gilt der alte Browserspeicher; so fehlt beim Start nichts.
    this.eigene = leseEigeneKonten(alterBrowserspeicher());
    this.anwenden();
  }

  verbinde(speicher: KontenrahmenSpeicher) {
    this.speicher = speicher;
  }

  /** Beim Programmstart: aus der Datenbank lesen; beim ersten Mal den alten Browserspeicher übernehmen. */
  async laden(): Promise<void> {
    if (!this.speicher) return;
    const gespeichert = await this.speicher.lesen();
    if (gespeichert) {
      this.eigene = leseEigeneKonten(gespeichert.customSkr42Accounts);
      this.anpassungen = leseAnpassungen(gespeichert.skr42Anpassungen);
      this.anwenden();
      return;
    }
    const alt = leseEigeneKonten(alterBrowserspeicher());
    this.eigene = alt;
    this.anpassungen = { nummernkreise: {}, konten: {} };
    if (alt.customMainCategories.length || alt.customSubCategories.length) {
      await this.sichern();
      try {
        localStorage.removeItem(ALTER_SCHLUESSEL);
      } catch {
        /* nichts zu tun */
      }
    } else this.anwenden();
  }

  /** Nach „Alle Daten löschen“: nur noch die mitgelieferte Liste. */
  zuruecksetzen() {
    this.eigene = { customMainCategories: [], customSubCategories: [] };
    this.anpassungen = { nummernkreise: {}, konten: {} };
    try {
      localStorage.removeItem(ALTER_SCHLUESSEL);
    } catch {
      /* nichts zu tun */
    }
    this.anwenden();
  }

  private anwenden() {
    const wirksam = wirksamerKontenrahmen(this.standard, this.eigene, this.anpassungen);
    SKR42_STRUCTURE.splice(0, SKR42_STRUCTURE.length, ...wirksam);
    notifySkr42Changed();
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vm_skr42_updated'));
    }
  }

  /** Erst im Arbeitsspeicher anwenden, dann in die Datenbank schreiben. */
  private async sichern() {
    this.anwenden();
    if (this.speicher) {
      await this.speicher.schreiben({ customSkr42Accounts: this.eigene, skr42Anpassungen: this.anpassungen });
    }
  }

  getCustomAccounts(): EigeneKonten {
    return JSON.parse(JSON.stringify(this.eigene));
  }

  getAnpassungen(): Skr42Anpassungen {
    return JSON.parse(JSON.stringify(this.anpassungen));
  }

  // ---------------------------------------------------------------------------
  // Datensicherung (Felder `customSkr42Accounts` und `skr42Anpassungen` der Einstellungen)
  // Fehlt ein Feld in der Datei (ältere Sicherung), bleibt der vorhandene Stand dazu unangetastet.
  // ---------------------------------------------------------------------------

  async ersetzeAusSicherung(eigene: unknown, anpassungen?: unknown) {
    if (eigene !== undefined) this.eigene = leseEigeneKonten(eigene);
    if (anpassungen !== undefined) this.anpassungen = leseAnpassungen(anpassungen);
    await this.sichern();
  }

  async ergaenzeAusSicherung(eigene: unknown, anpassungen?: unknown) {
    if (eigene !== undefined) this.eigene = ergaenzeEigene(this.eigene, leseEigeneKonten(eigene));
    if (anpassungen !== undefined) this.anpassungen = ergaenzeAnpassungen(this.anpassungen, leseAnpassungen(anpassungen));
    await this.sichern();
  }

  // ---------------------------------------------------------------------------
  // Anlegen
  // ---------------------------------------------------------------------------

  /** Schlägt die nächste freie Nummer vor: im Nummernkreis die höchste + 1, sonst den nächsten freien Tausender. */
  public suggestNextCode(type: 'income' | 'expense', parentMainCodeOrId?: string): string {
    const belegt = new Set(SKR42_STRUCTURE.flatMap(m => m.subCategories.map(s => s.code)));
    if (parentMainCodeOrId) {
      const main = SKR42_STRUCTURE.find(m => m.id === parentMainCodeOrId || m.code === parentMainCodeOrId);
      if (main) {
        const zahlen = main.subCategories.map(s => parseInt(s.code, 10)).filter(n => !isNaN(n));
        let n = zahlen.length ? Math.max(...zahlen) + 1 : parseInt(main.code, 10);
        if (!isNaN(n)) {
          while (belegt.has(String(n))) n++;
          return String(n);
        }
        return main.code;
      }
    }
    // Neuer Nummernkreis: nächster freier, runder Tausender über der höchsten Nummer dieses Typs.
    const alle = SKR42_STRUCTURE.filter(m => m.type === type)
      .flatMap(m => [m.code, ...m.subCategories.map(s => s.code)])
      .map(c => parseInt(c, 10))
      .filter(n => !isNaN(n));
    const hoechste = alle.length ? Math.max(...alle) : type === 'income' ? 40000 : 50000;
    let basis = Math.ceil((hoechste + 1) / 1000) * 1000;
    while (SKR42_STRUCTURE.some(m => m.code === String(basis)) || belegt.has(String(basis))) basis += 1000;
    return String(basis);
  }

  /** Neuer Nummernkreis mit einem ersten Konto (gleiche Nummer und Bezeichnung, wenn nicht anders angegeben). */
  public async addCustomMainCategory(input: CustomMainAccountInput): Promise<Skr42MainCategory> {
    const code = input.code.trim();
    const name = input.name.trim();
    const fehler = pruefeNeueNummer(code, 'nummernkreis', SKR42_STRUCTURE) ?? pruefeBezeichnung(name);
    if (fehler) throw new Error(fehler);
    const kontoCode = input.initialSubAccount?.code?.trim() || code;
    const kontoName = input.initialSubAccount?.name?.trim() || name;
    const f2 = pruefeNeueNummer(kontoCode, 'konto', SKR42_STRUCTURE);
    if (f2) throw new Error(f2);
    const konto: Skr42SubCategory = {
      code: kontoCode,
      name: kontoName,
      label: kontoText(kontoCode, kontoName),
      vatRateDefault: input.initialSubAccount?.vatRateDefault ?? 0,
      isCustom: true,
    };
    const neu: Skr42MainCategory = { id: `HK-${code}-CUSTOM`, code, name, type: input.type, subCategories: [konto], isCustom: true };
    this.eigene = { ...this.eigene, customMainCategories: [...this.eigene.customMainCategories, neu] };
    await this.sichern();
    return SKR42_STRUCTURE.find(m => m.code === code)!;
  }

  /** Neues Konto in einem vorhandenen Nummernkreis (Standard oder eigen). */
  public async addCustomSubCategory(input: CustomSubAccountInput): Promise<{ sub: Skr42SubCategory; main: Skr42MainCategory }> {
    const code = input.code.trim();
    const name = input.name.trim();
    const kreis = SKR42_STRUCTURE.find(m => m.id === input.mainCatIdOrCode || m.code === input.mainCatIdOrCode);
    if (!kreis) throw new Error(`Den Nummernkreis ${input.mainCatIdOrCode} gibt es nicht.`);
    const fehler = pruefeNeueNummer(code, 'konto', SKR42_STRUCTURE) ?? pruefeBezeichnung(name);
    if (fehler) throw new Error(fehler);
    const konto: Skr42SubCategory = { code, name, label: kontoText(code, name), vatRateDefault: input.vatRateDefault ?? 0, isCustom: true };
    // Eigene Konten hängen am festen Schlüssel des Nummernkreises, nicht an seiner heutigen Nummer.
    const kreisSchluessel = schluessel(kreis);
    if (kreis.isCustom) {
      this.eigene = {
        ...this.eigene,
        customMainCategories: this.eigene.customMainCategories.map(m =>
          m.code === kreisSchluessel ? { ...m, subCategories: [...m.subCategories, konto] } : m
        ),
      };
    } else {
      this.eigene = {
        ...this.eigene,
        customSubCategories: [...this.eigene.customSubCategories, { mainCatIdOrCode: kreisSchluessel, subCategory: konto }],
      };
    }
    await this.sichern();
    const main = SKR42_STRUCTURE.find(m => schluessel(m) === kreisSchluessel)!;
    return { sub: main.subCategories.find(s => s.code === code)!, main };
  }

  // ---------------------------------------------------------------------------
  // Ändern (Nummer, Bezeichnung, Steuersatz, ausgeblendet) – auch für Standardkonten
  // ---------------------------------------------------------------------------

  /**
   * Was eine Änderung bewirken würde, ohne sie auszuführen (für die Rückfrage): Fehlermeldung, wie viele Buchungen
   * angepasst würden und wie viele Konten eine neue Nummer bekämen.
   */
  async vorschau(art: 'konto' | 'nummernkreis', code: string, aenderung: KontoAnpassung): Promise<{ fehler: string | null; buchungen: number; konten: number }> {
    const plan = planeAenderung(SKR42_STRUCTURE, this.anpassungen, art, code, aenderung);
    if ('fehler' in plan) return { fehler: plan.fehler, buchungen: 0, konten: 0 };
    const nachher = wirksamerKontenrahmen(this.standard, this.eigene, plan.anpassungen);
    const neu = new Map(nachher.flatMap(m => m.subCategories).map(s => [schluessel(s), s.code]));
    const konten = SKR42_STRUCTURE.flatMap(m => m.subCategories).filter(s => neu.get(schluessel(s)) !== s.code).length;
    const buchungen = this.speicher ? buchungenAngleichen(await this.speicher.buchungen(), SKR42_STRUCTURE, nachher).length : 0;
    return { fehler: null, buchungen, konten };
  }

  /**
   * Ändert ein Konto oder einen Nummernkreis, gegeben über die heutige Nummer. Neue Nummern und Bezeichnungen gehen auf
   * alle Buchungen über (auch beim Zurücksetzen). Ergebnis: wie viele Buchungen geändert wurden und die Nummer danach.
   */
  async aendern(art: 'konto' | 'nummernkreis', code: string, aenderung: KontoAnpassung): Promise<{ buchungen: number; code: string }> {
    const plan = planeAenderung(SKR42_STRUCTURE, this.anpassungen, art, code, aenderung);
    if ('fehler' in plan) throw new Error(plan.fehler);
    const vorher = SKR42_STRUCTURE.slice(); // `anwenden` ersetzt die Einträge, die alten Objekte bleiben unverändert
    const key =
      art === 'konto'
        ? schluessel(vorher.flatMap(m => m.subCategories).find(s => s.code === code)!)
        : schluessel(vorher.find(m => m.code === code)!);
    this.anpassungen = plan.anpassungen;
    await this.sichern();
    let buchungen = 0;
    if (this.speicher) {
      const geaendert = buchungenAngleichen(await this.speicher.buchungen(), vorher, SKR42_STRUCTURE);
      if (geaendert.length) await this.speicher.buchungenSpeichern(geaendert);
      buchungen = geaendert.length;
    }
    const nachher =
      art === 'konto'
        ? SKR42_STRUCTURE.flatMap(m => m.subCategories).find(s => schluessel(s) === key)?.code
        : SKR42_STRUCTURE.find(m => schluessel(m) === key)?.code;
    return { buchungen, code: nachher ?? code };
  }

  kontoAendern(code: string, aenderung: KontoAnpassung) {
    return this.aendern('konto', code, aenderung);
  }

  nummernkreisAendern(code: string, aenderung: NummernkreisAnpassung) {
    return this.aendern('nummernkreis', code, aenderung);
  }

  // ---------------------------------------------------------------------------
  // Löschen (nur eigene, und nur, solange keine Buchung sie verwendet)
  // ---------------------------------------------------------------------------

  private async verwendungen(code: string): Promise<number> {
    return this.speicher ? kontoVerwendungen(await this.speicher.buchungen(), code) : 0;
  }

  /** Wie viele Buchungen ein Konto bzw. Nummernkreis verwenden (für Rückfragen). */
  async zaehleBuchungen(art: 'konto' | 'nummernkreis', code: string): Promise<number> {
    if (!this.speicher) return 0;
    const b = await this.speicher.buchungen();
    return art === 'konto' ? kontoVerwendungen(b, code) : nummernkreisVerwendungen(b, code);
  }

  public async deleteCustomMainCategory(codeOrId: string) {
    // heutige Nummer → fester Schlüssel (der Nummernkreis kann umnummeriert sein)
    const wirksam = SKR42_STRUCTURE.find(m => m.id === codeOrId || m.code === codeOrId);
    const key = wirksam ? schluessel(wirksam) : codeOrId;
    const kreis = this.eigene.customMainCategories.find(m => m.id === codeOrId || m.code === key);
    if (!kreis || !wirksam) throw new Error('Nur selbst angelegte Nummernkreise lassen sich löschen.');
    for (const s of wirksam.subCategories) {
      if ((await this.verwendungen(s.code)) > 0) {
        throw new Error(`Der Nummernkreis ${kreis.code} wird in Buchungen verwendet. Blenden Sie ihn stattdessen aus.`);
      }
    }
    let konten = this.anpassungen.konten;
    for (const s of wirksam.subCategories) konten = ohne(konten, schluessel(s));
    this.eigene = {
      customMainCategories: this.eigene.customMainCategories.filter(m => m !== kreis),
      // eigene Konten, die in diesem Nummernkreis hingen, gehen mit
      customSubCategories: this.eigene.customSubCategories.filter(u => u.mainCatIdOrCode !== kreis.code && u.mainCatIdOrCode !== kreis.id),
    };
    this.anpassungen = { nummernkreise: ohne(this.anpassungen.nummernkreise, kreis.code), konten };
    await this.sichern();
  }

  public async deleteCustomSubCategory(_mainCodeOrId: string, subCode: string) {
    const n = await this.verwendungen(subCode);
    if (n > 0) {
      throw new Error(`Das Konto ${subCode} wird in ${n} ${n === 1 ? 'Buchung' : 'Buchungen'} verwendet. Blenden Sie es stattdessen aus.`);
    }
    // heutige Nummer → fester Schlüssel (das Konto kann umnummeriert sein)
    const wirksam = SKR42_STRUCTURE.flatMap(m => m.subCategories).find(s => s.code === subCode);
    if (wirksam && !wirksam.isCustom) throw new Error('Nur selbst angelegte Konten lassen sich löschen.');
    const key = wirksam ? schluessel(wirksam) : subCode;
    this.eigene = {
      customMainCategories: this.eigene.customMainCategories.map(m =>
        m.subCategories.some(s => s.code === key) ? { ...m, subCategories: m.subCategories.filter(s => s.code !== key) } : m
      ),
      customSubCategories: this.eigene.customSubCategories.filter(u => u.subCategory.code !== key),
    };
    this.anpassungen = { ...this.anpassungen, konten: ohne(this.anpassungen.konten, key) };
    await this.sichern();
  }
}

export const customCategoryService = new CustomCategoryService();
