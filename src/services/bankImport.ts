import { naechsteJahresNummer } from '../utils/nummern';
import Papa from 'papaparse';
import { Transaction, TaxSphere, Skr42MainCategory } from '../types';
import { getSkr42Snapshot } from '../data/skr42Store';
import {
  ordneSpaltenZu, leseDatum, leseBetrag, findeDuplikat, duplikatText,
  kontoAusHistorie, kontoNachNummer, kontoFelder, SpaltenRegel
} from '../utils/importRegeln';

export interface ParsedBankRow {
  id: string;
  date: string;
  amount: number;
  partner: string;
  bookingText: string;
  iban?: string;
  suggestedSphere: TaxSphere;
  suggestedCategory: string;
  selected: boolean;
  /** Datum so, wie es in der Datei stand (für die Fehlermeldung). */
  rohDatum?: string;
  /** Fehler, die den Import der Zeile verhindern (z. B. unlesbares Datum, D-67). */
  fehler?: string[];
  /** Hinweise, die den Import nicht verhindern. */
  hinweise?: string[];
  /** Beschreibung der vorhandenen Buchung, der diese Zeile gleicht (D-65). */
  duplikat?: string;
  /** Gewähltes Konto des Kontenrahmens (SKR 42), leer = keins (D-69). */
  skrAccount?: string;
  /** Das Konto wurde aus einer früheren Buchung desselben Partners vorgeschlagen. */
  kontoVorschlag?: boolean;
}

type BankFeld = 'date' | 'amount' | 'partner' | 'text' | 'iban';

/** Spalten der Bank-CSV: genaue Namen zuerst; „name“ nur als ganze Überschrift (D-68). */
const BANK_SPALTEN: SpaltenRegel<BankFeld>[] = [
  { feld: 'date', genau: ['buchungstag', 'buchungsdatum', 'datum', 'valutadatum', 'valuta', 'wertstellung', 'date', 'tag'], teil: ['buchungstag', 'buchungsdatum', 'datum', 'valuta'] },
  { feld: 'amount', genau: ['betrag', 'betrageur', 'betragineur', 'umsatz', 'amount', 'umsatzineur'], teil: ['betrag', 'umsatz', 'amount'] },
  { feld: 'partner', genau: ['beguenstigterzahlungspflichtiger', 'namezahlungsbeteiligter', 'beguenstigter', 'zahlungsempfaenger', 'zahlungspflichtiger', 'auftraggeber', 'empfaenger', 'zahlungspartner', 'partner', 'absender', 'name'], teil: ['beguenstigter', 'zahlungspflichtiger', 'zahlungsempfaenger', 'empfaenger', 'auftraggeber', 'zahlungspartner', 'absender'] },
  { feld: 'text', genau: ['verwendungszweck', 'buchungstext', 'text', 'beschreibung', 'notiz'], teil: ['verwendungszweck', 'buchungstext', 'beschreibung'] },
  { feld: 'iban', genau: ['iban', 'kontonummeriban', 'kontonummer', 'ibanzahlungsbeteiligter'], teil: ['iban'] }
];

/**
 * Prüft eine Zeile (nach dem Einlesen und nach jeder Änderung in der
 * Vorschau): Fehler, Doppelbuchung, Auswahl. Zeilen mit Fehler oder
 * möglichem Duplikat sind abgewählt.
 */
export function pruefeBankZeile(r: ParsedBankRow, vorhandene: Transaction[], auswahlSetzen = false): ParsedBankRow {
  const fehler: string[] = [];
  if (!r.date) fehler.push(r.rohDatum ? `Datum „${r.rohDatum}“ nicht lesbar – bitte in der Vorschau eintragen.` : 'Datum fehlt – bitte in der Vorschau eintragen.');
  if (!r.amount) fehler.push('Betrag fehlt, ist 0 oder nicht lesbar.');
  const dup = r.date ? findeDuplikat({ date: r.date, amount: r.amount, type: r.amount < 0 ? 'expense' : 'income', partner: r.partner, bookingText: r.bookingText }, vorhandene) : undefined;
  const neu: ParsedBankRow = { ...r, fehler, duplikat: dup ? duplikatText(dup) : undefined };
  if (fehler.length > 0) neu.selected = false;
  else if (auswahlSetzen) neu.selected = !dup;
  return neu;
}

export const BankImportService = {
  // Suggest tax sphere and category based on booking description and partner text
  guessSphereAndCategory(text: string, amount: number): { sphere: TaxSphere; category: string } {
    const lower = text.toLowerCase();

    // 1. Ideeller Bereich
    if (lower.includes('beitrag') || lower.includes('aufnahme') || lower.includes('mitglied') || lower.includes('dtaus') || lower.includes('sepa-el')) {
      return { sphere: 'ideell', category: 'Mitgliedsbeiträge' };
    }
    if (lower.includes('spende') || lower.includes('zuwendung') || lower.includes('schenkung')) {
      return { sphere: 'ideell', category: 'Spenden / Schenkungen' };
    }
    if (lower.includes('zuschuss') || lower.includes('foerderung') || lower.includes('förderung') || lower.includes('gemeinde') || lower.includes('landessportbund') || lower.includes('lsb')) {
      return { sphere: 'ideell', category: 'Öffentliche Zuschüsse (Gemeinde/Land)' };
    }
    if (lower.includes('arag') || lower.includes('versicherung') || lower.includes('verband') || lower.includes('sportbund')) {
      return { sphere: 'ideell', category: 'Verbandsabgaben & Beiträge' };
    }
    if (lower.includes('porto') || lower.includes('telekom') || lower.includes('vodafone') || lower.includes('software') || lower.includes('hosting')) {
      return { sphere: 'ideell', category: 'Allgemeine Verwaltungskosten' };
    }
    if (lower.includes('gebuehr') || lower.includes('kontofuehrung') || lower.includes('entgeltabrechnung')) {
      return { sphere: 'ideell', category: 'Geldverkehrsspesen / Bankgebühren' };
    }

    // 2. Vermögensverwaltung
    if (lower.includes('zinsen') || lower.includes('zinsgutschrift') || lower.includes('kupon') || lower.includes('dividende')) {
      return { sphere: 'vermoegen', category: 'Zinserträge' };
    }
    if (lower.includes('pacht') || lower.includes('mieteinnahme') || lower.includes('vereinsheim miete')) {
      return { sphere: 'vermoegen', category: 'Pachterlöse Vereinsgelände' };
    }

    // 3. Zweckbetrieb
    if (lower.includes('uebungsleiter') || lower.includes('übungsleiter') || lower.includes('trainer') || lower.includes('aufwandsentschaedigung') || lower.includes('ehrenamt')) {
      return { sphere: 'zweckbetrieb', category: 'Übungsleiterpauschalen (§ 3 Nr. 26 EStG)' };
    }
    if (lower.includes('turnier') || lower.includes('startgeld') || lower.includes('meldegeld') || lower.includes('eintritt')) {
      return { sphere: 'zweckbetrieb', category: 'Startgelder & Meldegebühren' };
    }
    if (lower.includes('schiedsrichter') || lower.includes('kampfgericht') || lower.includes('spielleiter')) {
      return { sphere: 'zweckbetrieb', category: 'Schiedsrichter- & Kampfgerichtskosten' };
    }
    if (lower.includes('sport') || lower.includes('baelle') || lower.includes('bälle') || lower.includes('trikot') || lower.includes('netz') || lower.includes('turnmatten')) {
      return { sphere: 'zweckbetrieb', category: 'Sportgeräte & Trainingsmaterial' };
    }
    if (lower.includes('halle') || lower.includes('platzmiete') || lower.includes('flutlicht')) {
      return { sphere: 'zweckbetrieb', category: 'Hallen- & Platzmieten (Spielbetrieb)' };
    }

    // 4. Wirtschaftlicher Geschäftsbetrieb
    if (lower.includes('sponsoring') || lower.includes('werbung') || lower.includes('bande') || lower.includes('anzeige') || lower.includes('plakat')) {
      return { sphere: 'wirtschaftlich', category: 'Banden- & Bannerwerbung' };
    }
    if (lower.includes('metro') || lower.includes('rewe') || lower.includes('edeka') || lower.includes('getraenke') || lower.includes('getränke') || lower.includes('brauerei') || lower.includes('kiosk') || lower.includes('wurst') || lower.includes('fleisch')) {
      return { sphere: 'wirtschaftlich', category: 'Wareneinkauf Speisen & Getränke' };
    }
    if (lower.includes('gema') || lower.includes('festzelt') || lower.includes('veranstaltungstechnik')) {
      return { sphere: 'wirtschaftlich', category: 'GEMA-Gebühren für Festveranstaltungen' };
    }

    // Default fallback
    if (amount > 0) {
      return { sphere: 'ideell', category: 'Sonstige ideelle Einnahmen' };
    } else {
      return { sphere: 'ideell', category: 'Allgemeine Verwaltungskosten' };
    }
  },

  // Datum und Betrag liest seit P17 `src/utils/importRegeln.ts` (leseDatum,
  // leseBetrag). Die alten Funktionen setzten ein unlesbares Datum still auf
  // „heute“ und lasen „1.250“ als 1,25 €.

  // Parse generic German Bank CSV (Sparkasse, Volksbank, VR-NetWorld, Postbank, Commerzbank, etc.)
  /**
   * Wertet fertige Tabellenzeilen eines Kontoauszugs aus (Schlüssel = Spaltenüberschrift).
   * Gemeinsamer Kern für CSV und Excel (P28).
   */
  parseBankZeilen(rows: Record<string, string>[], vorhandene: Transaction[] = []): ParsedBankRow[] {
    if (!rows || rows.length === 0) return [];

    // Spalten zuordnen (D-68): genaue Überschriften zuerst, jede Spalte nur einmal
    const keys = Object.keys(rows[0]);
    const spalten = ordneSpaltenZu(keys, BANK_SPALTEN);
    const dateKey = spalten.date;
    const amountKey = spalten.amount;
    const partnerKey = spalten.partner;
    const textKey = spalten.text;
    const ibanKey = spalten.iban;
    const skr = getSkr42Snapshot();

    const parsedRows: ParsedBankRow[] = [];

    rows.forEach((row, idx) => {
      const rawDate = (dateKey ? row[dateKey] : '') || '';
      const rawAmount = (amountKey ? row[amountKey] : '') || '';
      const rawPartner = partnerKey ? row[partnerKey] : '';
      const rawText = textKey ? row[textKey] : '';
      const rawIban = ibanKey ? row[ibanKey] : '';

      if (!rawDate.trim() && !rawAmount.trim()) return;

      // Unlesbares Datum bleibt leer und wird zur Fehlerzeile (D-67)
      const date = leseDatum(rawDate) || '';
      const zahl = leseBetrag(rawAmount);
      const amount = zahl ? zahl.wert : 0;
      const hinweise: string[] = [];
      if (zahl?.mehrdeutig) hinweise.push(`Betrag „${rawAmount.trim()}“ als ${amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € gelesen (Tausenderpunkt) – bitte prüfen.`);
      const partner = (rawPartner || 'Unbekannter Partner').trim();
      const bookingText = (rawText || (partner !== 'Unbekannter Partner' ? partner : 'Banküberweisung')).trim();

      const combinedText = `${partner} ${bookingText}`;
      const { sphere, category } = BankImportService.guessSphereAndCategory(combinedText, amount);

      // Konto aus früheren Buchungen desselben Partners (D-69)
      const alt = rawPartner ? kontoAusHistorie(rawPartner, amount < 0 ? 'expense' : 'income', vorhandene) : undefined;
      const altKonto = alt?.skrAccount ? kontoNachNummer(alt.skrAccount, skr) : null;

      parsedRows.push(pruefeBankZeile({
        id: `bank-row-${idx}-${Date.now()}`,
        date,
        rohDatum: rawDate.trim(),
        amount,
        partner,
        bookingText,
        iban: rawIban,
        suggestedSphere: altKonto && alt ? alt.sphere : sphere,
        suggestedCategory: altKonto ? altKonto.sub.label : category,
        skrAccount: altKonto ? altKonto.sub.code : '',
        kontoVorschlag: !!altKonto,
        hinweise,
        selected: true
      }, vorhandene, true));
    });

    return parsedRows;
  },

  parseBankCSV(fileContent: string, vorhandene: Transaction[] = []): Promise<ParsedBankRow[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: '', // auto-detect delimiter (, or ; or tab)
        complete: (results) => {
          try {
            resolve(BankImportService.parseBankZeilen(results.data as Record<string, string>[], vorhandene));
          } catch (err) {
            reject(err);
          }
        },
        error: (err) => reject(err)
      });
    });
  },

  // Convert selected bank rows into Transactions
  convertToTransactions(
    rows: ParsedBankRow[],
    accountId: string,
    vorhandeneBelegnummern: Array<string | null | undefined> = [],
    skr: readonly Skr42MainCategory[] = getSkr42Snapshot()
  ): Transaction[] {
    // Belegnummern BK-<Jahr>-<n>: höchste vorhandene des Jahres plus eins.
    // Vorher begann jeder Import wieder bei 1 und vergab dieselben Nummern
    // erneut (D-66).
    const vergeben: Array<string | null | undefined> = [...vorhandeneBelegnummern];
    // Zeilen mit Fehler werden nie übernommen, auch wenn sie angehakt wären
    return rows.filter(r => r.selected && !(r.fehler && r.fehler.length > 0) && r.date).map((r, i) => {
      // Nummer im Jahr der Buchung, nicht im laufenden Jahr
      const docNum = naechsteJahresNummer('BK', vergeben, Number(r.date.slice(0, 4)) || new Date().getFullYear());
      vergeben.push(docNum);
      const isIncome = r.amount >= 0;
      // Konto des Kontenrahmens mit seiner Umsatzsteuer (D-69); ohne Konto 0 %
      // statt pauschal nach Sphäre
      const konto = r.skrAccount ? kontoNachNummer(r.skrAccount, skr) : null;
      const kontoTeil = konto ? kontoFelder(konto) : { category: r.suggestedCategory, vatRate: 0 as const };

      return {
        id: `tx-import-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        date: r.date,
        amount: r.amount,
        type: isIncome ? 'income' : 'expense',
        accountId,
        documentNumber: docNum,
        bookingText: r.bookingText,
        partner: r.partner,
        sphere: r.suggestedSphere,
        ...kontoTeil,
        notes: `Importiert aus Bankauszug. IBAN: ${r.iban || '–'}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });
  }
};
