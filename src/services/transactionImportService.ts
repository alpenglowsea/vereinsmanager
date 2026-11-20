import { Transaction, TaxSphere, FinancialAccount, ClubSettings, Skr42MainCategory } from '../types';
import { getSkr42Snapshot } from '../data/skr42Store';
import { naechsteJahresNummer } from '../utils/nummern';
import {
  ordneSpaltenZu, leseDatum, leseBetrag, artAusText, findeDuplikat, duplikatText,
  findeSkrKonto, kontoAusHistorie, kontoNachNummer, kontoFelder, SpaltenRegel
} from '../utils/importRegeln';

export interface TransactionColumnMapping {
  date?: string;
  documentNumber?: string;
  partner?: string;
  bookingText?: string;
  amount?: string;
  type?: string;
  sphere?: string;
  category?: string;
  subCategory?: string;
  account?: string;
  vatRate?: string;
  notes?: string;
}

export interface ParsedTransactionRow {
  id: string;
  selected: boolean;
  raw: Record<string, string>;
  hasWarnings: boolean;
  warnings: string[];
  isDuplicate: boolean;
  existingTransactionId?: string;
  transaction: Transaction;
  /** Fehler, die den Import der Zeile verhindern (z. B. unlesbares Datum, D-67). */
  fehler: string[];
  /** Datum so, wie es in der Datei stand. */
  rohDatum: string;
  /** Konto aus einer früheren Buchung desselben Partners vorgeschlagen (D-69). */
  kontoVorschlag?: boolean;
}

/**
 * Prüft eine Vorschauzeile nach dem Einlesen und nach jeder Änderung:
 * Fehler, Doppelbuchung (D-65), Auswahl. Zeilen mit Fehler sind abgewählt
 * und lassen sich erst nach der Berichtigung anhaken.
 */
export function pruefeImportZeile(
  item: ParsedTransactionRow,
  vorhandene: Transaction[],
  auswahlSetzen = false
): ParsedTransactionRow {
  const tx = item.transaction;
  const fehler: string[] = [];
  if (!tx.date) fehler.push(item.rohDatum ? `Datum „${item.rohDatum}“ nicht lesbar – bitte in der Vorschau eintragen.` : 'Datum fehlt – bitte in der Vorschau eintragen.');
  if (!tx.amount) fehler.push('Betrag fehlt, ist 0 oder nicht lesbar.');
  const dup = tx.date ? findeDuplikat(tx, vorhandene) : undefined;
  const warnings = item.warnings.filter(w => !w.startsWith('Gleicht Beleg') && !w.startsWith('Kein Konto'));
  if (dup) warnings.push(duplikatText(dup));
  if (tx.type !== 'transfer' && !tx.skrAccount) warnings.push('Kein Konto (SKR 42) gewählt.');
  const neu: ParsedTransactionRow = {
    ...item,
    fehler,
    warnings,
    hasWarnings: warnings.length > 0,
    isDuplicate: !!dup,
    existingTransactionId: dup?.id
  };
  if (fehler.length > 0) neu.selected = false;
  else if (auswahlSetzen) neu.selected = !dup;
  return neu;
}

/**
 * Universal CSV / TSV / Tab-Separated Clipboard Parser
 * Handles Excel, Google Sheets, Quotes, Semicolons, Commas, Tabs, multiline strings and BOM
 */
export function parseCSVToRows(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Strip BOM if present
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  if (!cleanText) return { headers: [], rows: [] };

  // Detect delimiter from first 3 lines
  const firstLines = cleanText.split(/\r?\n/).slice(0, 3).join('\n');
  const countSemicolons = (firstLines.match(/;/g) || []).length;
  const countTabs = (firstLines.match(/\t/g) || []).length;
  const countCommas = (firstLines.match(/,/g) || []).length;

  let delimiter = ',';
  if (countSemicolons >= countCommas && countSemicolons >= countTabs) {
    delimiter = ';';
  } else if (countTabs > countCommas && countTabs > countSemicolons) {
    delimiter = '\t';
  }

  // Parse CSV state machine
  const allRows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\r') {
        // ignore CR
      } else if (char === '\n') {
        currentRow.push(currentVal.trim());
        if (currentRow.some(val => val !== '')) {
          allRows.push(currentRow);
        }
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  // Flush last token
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(val => val !== '')) {
      allRows.push(currentRow);
    }
  }

  if (allRows.length === 0) return { headers: [], rows: [] };

  const rawHeaders = allRows[0].map(h => h.replace(/^["']|["']$/g, '').trim());
  // Ensure unique header names
  const headerCount: Record<string, number> = {};
  const headers = rawHeaders.map(h => {
    const name = h || 'Spalte';
    if (headerCount[name]) {
      headerCount[name]++;
      return `${name}_${headerCount[name]}`;
    }
    headerCount[name] = 1;
    return name;
  });

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < allRows.length; i++) {
    const rowValues = allRows[i];
    const rowObj: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObj[header] = (rowValues[index] || '').replace(/^["']|["']$/g, '').trim();
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

/**
 * Auto-detect column mappings for German bookkeeping, Excel & Google Sheets headers
 */
const TABELLEN_SPALTEN: SpaltenRegel<keyof TransactionColumnMapping>[] = [
  { feld: 'date', genau: ['datum', 'buchungsdatum', 'belegdatum', 'buchungstag', 'valutadatum', 'valuta', 'wertstellung', 'transaktionsdatum', 'date'], teil: ['buchungsdatum', 'buchungstag', 'belegdatum', 'datum', 'valuta'] },
  { feld: 'documentNumber', genau: ['belegnummer', 'belegnr', 'beleg', 'rechnungsnummer', 'rechnungsnr', 'buchungsnummer', 'docnr', 'documentnumber', 'nummer', 'nr'], teil: ['belegnummer', 'belegnr', 'rechnungsnummer'] },
  { feld: 'partner', genau: ['zahlungspartner', 'partner', 'beguenstigterzahlungspflichtiger', 'namezahlungsbeteiligter', 'beguenstigter', 'empfaenger', 'zahlungsempfaenger', 'auftraggeber', 'auftraggebername', 'gegenpartei', 'kunde', 'lieferant', 'absender', 'payee', 'name'], teil: ['zahlungspartner', 'beguenstigter', 'zahlungspflichtiger', 'empfaenger', 'auftraggeber', 'absender'] },
  { feld: 'bookingText', genau: ['buchungstext', 'verwendungszweck', 'beschreibung', 'text', 'betreff', 'vorgang', 'zweck', 'description', 'umsatztext', 'bookingtext'], teil: ['verwendungszweck', 'buchungstext', 'beschreibung'] },
  { feld: 'amount', genau: ['betrag', 'betrageur', 'betragineur', 'umsatz', 'summe', 'wert', 'amount', 'zahlbetrag', 'gesamtbetrag', 'bruttobetrag'], teil: ['betrag', 'umsatz', 'amount'] },
  { feld: 'type', genau: ['art', 'buchungsart', 'typ', 'type', 'sollhaben', 'sh', 'einnahmeausgabe', 'ea', 'richtung', 'buchungsrichtung'], teil: ['buchungsart', 'sollhaben', 'einnahmeausgabe'] },
  { feld: 'sphere', genau: ['sphaere', 'steuerlichesphaere', 'steuerlichersphaere', 'steuerlicherbereich', 'steuerbereich', 'bereich', 'taetigkeitsbereich', 'sphere'], teil: ['sphaere', 'sphere', 'steuerbereich'] },
  { feld: 'subCategory', genau: ['skrkonto', 'skr42konto', 'skr42', 'skr', 'sachkonto', 'buchungskonto', 'nebenkategorie', 'unterkategorie', 'nebenkategorieskr42', 'subcategory'], teil: ['skr', 'sachkonto', 'nebenkategorie', 'unterkategorie'] },
  { feld: 'category', genau: ['hauptkategorie', 'kategorie', 'nummernkreis', 'kostenart', 'category'], teil: ['hauptkategorie', 'nummernkreis'] },
  { feld: 'account', genau: ['konto', 'finanzkonto', 'bankkonto', 'kasse', 'zahlungskonto', 'kontoname', 'account'], teil: ['finanzkonto', 'bankkonto', 'zahlungskonto'] },
  { feld: 'vatRate', genau: ['mwst', 'ust', 'mwstsatz', 'ustsatz', 'steuersatz', 'mehrwertsteuer', 'umsatzsteuer', 'vat', 'taxrate'], teil: ['mwst', 'umsatzsteuer', 'ustsatz', 'steuersatz'] },
  { feld: 'notes', genau: ['notiz', 'notizen', 'bemerkung', 'anmerkung', 'kommentar', 'hinweis', 'notes'], teil: ['notiz', 'bemerkung', 'kommentar'] }
];

/**
 * Spaltenzuordnung: erst genaue Überschriften, dann Teiltreffer nur mit
 * längeren Wörtern, jede Spalte nur einmal (D-70). Vorher fingen Kurzwörter
 * wie „nr“, „art“, „bank“ oder „eur“ falsche Spalten ein.
 */
export function autoDetectTransactionMapping(headers: string[]): TransactionColumnMapping {
  return ordneSpaltenZu(headers, TABELLEN_SPALTEN);
}

// Beträge und Daten liest seit P17 `src/utils/importRegeln.ts` (leseBetrag,
// leseDatum). Die alten Funktionen machten jeden Wert mit „S“ am Ende negativ
// (D-71) und setzten ein unlesbares Datum still auf „heute“ (D-67).

/**
 * Intelligent Sphere detector & SKR 42 matcher
 */
export function detectTaxSphere(rawSphere: string, categoryName: string, subCategoryCodeOrName: string, text: string): TaxSphere {
  const combined = `${rawSphere} ${categoryName} ${subCategoryCodeOrName} ${text}`.toLowerCase();

  // Explicit sphere string matching
  if (rawSphere) {
    const s = rawSphere.toLowerCase();
    if (s.includes('1') || s.includes('ideell')) return 'ideell';
    if (s.includes('2') || s.includes('vermög') || s.includes('vermoeg')) return 'vermoegen';
    if (s.includes('3') || s.includes('zweck')) return 'zweckbetrieb';
    if (s.includes('4') || s.includes('wirtsch') || s.includes('wgb') || s.includes('geschäft')) return 'wirtschaftlich';
  }

  // SKR 42 Kontonummer prefixes
  const codeMatch = subCategoryCodeOrName.match(/\b(3\d{3}|4\d{3}|5\d{3}|6\d{3}|7\d{3})\b/);
  if (codeMatch) {
    const codeNum = parseInt(codeMatch[1], 10);
    // 3100-3499, 5100-5499: Ideeller Bereich
    if ((codeNum >= 3000 && codeNum <= 3499) || (codeNum >= 5000 && codeNum <= 5499)) return 'ideell';
    // 3500-3999, 5500-5999: Vermögensverwaltung
    if ((codeNum >= 3500 && codeNum <= 3999) || (codeNum >= 5500 && codeNum <= 5999)) return 'vermoegen';
    // 4100-4499, 6100-6999: Zweckbetrieb
    if ((codeNum >= 4000 && codeNum <= 4499) || (codeNum >= 6000 && codeNum <= 6999)) return 'zweckbetrieb';
    // 4500-4999, 7000-7999: Wirtschaftlicher Geschäftsbetrieb
    if ((codeNum >= 4500 && codeNum <= 4999) || (codeNum >= 7000 && codeNum <= 7999)) return 'wirtschaftlich';
  }

  // Keyword rules
  if (combined.includes('mitglied') || combined.includes('beitrag') || combined.includes('spende') || combined.includes('zuschuss') || combined.includes('zuwendung') || combined.includes('ehrenamtspauschale 3 nr 26a') || combined.includes('verband')) {
    return 'ideell';
  }
  if (combined.includes('zins') || combined.includes('dividende') || combined.includes('verpachtung') || combined.includes('miete') || combined.includes('werberechte') || combined.includes('immobilie')) {
    return 'vermoegen';
  }
  if (combined.includes('turnier') || combined.includes('lehrgang') || combined.includes('kurs') || combined.includes('startgeld') || combined.includes('eintritt') || combined.includes('sportgerät') || combined.includes('übungsleiter') || combined.includes('schiedsrichter')) {
    return 'zweckbetrieb';
  }
  if (combined.includes('bewirtung') || combined.includes('kiosk') || combined.includes('werbung') || combined.includes('bandenwerbung') || combined.includes('sponsoring') || combined.includes('trikotwerbung') || combined.includes('vereinsfest') || combined.includes('getränke') || combined.includes('grill') || combined.includes('fanartikel')) {
    return 'wirtschaftlich';
  }

  return 'ideell';
}

/**
 * Wandelt die Zeilen der Datei in Vorschauzeilen um. Nichts wird weggelassen:
 * Was nicht lesbar ist, bleibt als Zeile mit Fehler stehen und lässt sich in
 * der Vorschau berichtigen (wie Android).
 */
export function convertRowsToTransactions(
  rows: Record<string, string>[],
  mapping: TransactionColumnMapping,
  existingTransactions: Transaction[],
  accounts: FinancialAccount[],
  _settings: ClubSettings,
  defaultAccountId: string,
  defaultSphere: TaxSphere,
  defaultVatRate: 0 | 7 | 19 = 0,
  defaultType: 'auto' | 'income' | 'expense' = 'auto',
  skr: readonly Skr42MainCategory[] = getSkr42Snapshot()
): ParsedTransactionRow[] {
  const wert = (row: Record<string, string>, feld: keyof TransactionColumnMapping) => {
    const spalte = mapping[feld];
    return spalte ? (row[spalte] || '').trim() : '';
  };

  const accountNameToIdMap = new Map<string, string>();
  accounts.forEach(acc => {
    accountNameToIdMap.set(acc.id.toLowerCase(), acc.id);
    accountNameToIdMap.set(acc.name.toLowerCase().replace(/\s/g, ''), acc.id);
    if (acc.iban) accountNameToIdMap.set(acc.iban.toLowerCase().replace(/\s/g, ''), acc.id);
  });

  // Belegnummern: aus der Datei, wenn noch frei; sonst BE-<Jahr der Buchung>-<höchste + 1>
  const vergeben: string[] = existingTransactions.map(t => (t.documentNumber || '').trim()).filter(Boolean);
  const vorhandeneNr = new Set(vergeben.map(n => n.toLowerCase()));
  const jetzt = new Date().toISOString();

  return rows.map((row, index) => {
    const warnings: string[] = [];
    const id = `tx-imp-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`;

    // 1. Datum: unlesbar bleibt leer und wird zur Fehlerzeile (D-67)
    const rohDatum = wert(row, 'date');
    const date = leseDatum(rohDatum) || '';

    // 2. Betrag und Art: „S“/„H“ nur direkt hinter der Zahl (D-71)
    const rohBetrag = wert(row, 'amount');
    const zahl = leseBetrag(rohBetrag);
    if (zahl?.mehrdeutig) warnings.push(`Betrag „${rohBetrag}“ als ${zahl.wert.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € gelesen (Tausenderpunkt) – bitte prüfen.`);
    const rohArt = wert(row, 'type');
    const artSpalte = rohArt ? artAusText(rohArt) : null;
    if (rohArt && !artSpalte) warnings.push(`Art „${rohArt}“ nicht erkannt – das Vorzeichen des Betrags entscheidet.`);
    const betrag = zahl ? zahl.wert : 0;
    // Art-Spalte geht vor; ohne sie gilt die Vorgabe, bei „automatisch“ das Vorzeichen
    const txType: 'income' | 'expense' | 'transfer' =
      artSpalte ?? (defaultType === 'auto' ? (betrag < 0 ? 'expense' : 'income') : defaultType);
    const amount = txType === 'expense' ? -Math.abs(betrag) : Math.abs(betrag);

    // 3. Partner und Text
    const partner = wert(row, 'partner');
    const bookingText = wert(row, 'bookingText');
    if (!partner && !bookingText) warnings.push('Weder Partner noch Buchungstext vorhanden.');

    // 4. Finanzkonto
    let accountId = defaultAccountId || accounts[0]?.id || 'acc-1';
    const rohKonto = wert(row, 'account').toLowerCase().replace(/\s/g, '');
    if (rohKonto && accountNameToIdMap.has(rohKonto)) accountId = accountNameToIdMap.get(rohKonto)!;

    // 5. Sphäre: aus der Spalte, sonst aus dem Vorschlag, sonst Vorgabe
    const rohSphaere = wert(row, 'sphere');
    let sphere: TaxSphere | null = rohSphaere ? detectTaxSphere(rohSphaere, '', '', '') : null;

    // 6. Konto (SKR 42) mit Umsatzsteuer aus dem Konto (D-69): aus der Datei,
    // sonst aus früheren Buchungen desselben Partners; kein Raten
    let kontoTeil: Partial<Transaction> = { category: wert(row, 'category') || wert(row, 'subCategory') || '' };
    let kontoVorschlag = false;
    let vatRate: 0 | 7 | 19 = defaultVatRate;
    if (txType !== 'transfer') {
      const richtung = txType;
      const gefunden = findeSkrKonto(wert(row, 'subCategory'), richtung, skr) || findeSkrKonto(wert(row, 'category'), richtung, skr);
      if (gefunden) {
        kontoTeil = kontoFelder(gefunden);
        vatRate = gefunden.sub.vatRateDefault;
      } else {
        if (wert(row, 'subCategory')) warnings.push(`Konto „${wert(row, 'subCategory')}“ nicht im Kontenrahmen gefunden – bitte wählen.`);
        const alt = partner ? kontoAusHistorie(partner, richtung, existingTransactions) : undefined;
        const altKonto = alt?.skrAccount ? kontoNachNummer(alt.skrAccount, skr) : null;
        if (alt && altKonto) {
          kontoTeil = { ...kontoFelder(altKonto), department: alt.department };
          vatRate = alt.vatRate ?? altKonto.sub.vatRateDefault;
          if (!sphere) sphere = alt.sphere;
          kontoVorschlag = true;
        }
      }
    }
    // Umsatzsteuer aus einer eigenen Spalte geht vor
    const rohUst = wert(row, 'vatRate').replace(/[^0-9]/g, '');
    if (rohUst) {
      const n = parseInt(rohUst, 10);
      vatRate = n === 7 ? 7 : n === 19 ? 19 : 0;
    }

    // 7. Belegnummer
    let docNum = wert(row, 'documentNumber');
    if (docNum && vorhandeneNr.has(docNum.toLowerCase())) {
      warnings.push(`Belegnummer ${docNum} gibt es schon – es wird eine neue vergeben.`);
      docNum = '';
    }
    if (!docNum) docNum = naechsteJahresNummer('BE', vergeben, Number(date.slice(0, 4)) || new Date().getFullYear());
    vergeben.push(docNum);
    vorhandeneNr.add(docNum.toLowerCase());

    const notes = wert(row, 'notes');

    const createdTx: Transaction = {
      id,
      date,
      amount,
      type: txType,
      accountId,
      documentNumber: docNum,
      bookingText: bookingText || (partner ? `Zahlung ${partner}` : 'Importierte Buchung'),
      partner: partner || (txType === 'transfer' ? '' : 'Sonstiger Partner'),
      sphere: sphere || defaultSphere,
      category: '',
      ...kontoTeil,
      vatRate,
      notes: notes ? `${notes} (Excel/Sheets Import)` : 'Importiert aus Excel / Google Sheets',
      createdAt: jetzt,
      updatedAt: jetzt
    };

    return pruefeImportZeile({
      id,
      selected: true,
      raw: row,
      hasWarnings: false,
      warnings,
      isDuplicate: false,
      transaction: createdTx,
      fehler: [],
      rohDatum,
      kontoVorschlag
    }, existingTransactions, true);
  });
}

/**
 * Generate a ready-to-use CSV Sample Template with SKR 42 example rows
 * Suitable for opening in Google Sheets, Microsoft Excel, LibreOffice or Apple Numbers
 */
export function generateSampleTransactionCSVTemplate(settings: ClubSettings, accounts: FinancialAccount[]): string {
  const headers = [
    'Datum',
    'Belegnummer',
    'Zahlungspartner',
    'Buchungstext / Verwendungszweck',
    'Betrag (€)',
    'Buchungsart',
    'Steuerliche Sphäre',
    'Nummernkreis',
    'SKR-Konto',
    'Konto',
    'MwSt-Satz (%)',
    'Notizen'
  ];

  const primaryAcc = accounts[0]?.name || 'Girokonto';
  const cashAcc = accounts.find(a => a.accountType === 'cash')?.name || 'Hauptkasse';

  const rows = [
    [
      '15.01.2025',
      'BE-2025-001',
      'Mitglieder TSV Musterstadt',
      'SEPA-Lastschrift Mitgliedsbeiträge Q1',
      '3450.00',
      'Einnahme',
      '1. Ideeller Bereich',
      'Echte Mitgliedsbeiträge & Aufnahmegebühren',
      '40000 - Echte Mitgliedsbeiträge (laufend)',
      primaryAcc,
      '0',
      'Beitragseinzug 1. Quartal'
    ],
    [
      '20.01.2025',
      'BE-2025-002',
      'Musterstadt Stadtwerke AG',
      'Zweckgebundene Spende für neue Jugendtore',
      '1500.00',
      'Einnahme',
      '1. Ideeller Bereich',
      'Spenden, Schenkungen & Zuwendungen',
      '40450 - Geldspenden (mit Zuwendungsbestätigung)',
      primaryAcc,
      '0',
      'Spendenbescheinigung ausgestellt'
    ],
    [
      '25.01.2025',
      'BE-2025-003',
      'Landessportbund e.V.',
      'Jahresbeitrag Sportfachverbände & LSB',
      '-450.00',
      'Ausgabe',
      '1. Ideeller Bereich',
      'Satzungsgemäße Verbandsausgaben',
      '66100 - Verbandsabgaben & LSB-Beiträge',
      primaryAcc,
      '0',
      'Mitgliedschaftsbeitrag Verband'
    ],
    [
      '30.01.2025',
      'BE-2025-004',
      'Sparkasse Musterstadt',
      'Zinserträge Festgeldanlage Vereinsrücklage',
      '180.00',
      'Einnahme',
      '2. Vermögensverwaltung',
      'Zinserträge & Finanzanlagen',
      '47000 - Zinserträge Bankkonten / Festgeld',
      primaryAcc,
      '0',
      'Zinsabrechnung Geschäftsjahr'
    ],
    [
      '05.02.2025',
      'BE-2025-005',
      'Teilnehmer Fußball-Camp',
      'Teilnahmegebühren Oster-Fußballferiencamp',
      '850.00',
      'Einnahme',
      '3. Zweckbetrieb',
      'Sportliche Veranstaltungen & Wettkämpfe',
      '41300 - Melde- & Startgelder',
      primaryAcc,
      '0',
      '20 Kinder angemeldet'
    ],
    [
      '10.02.2025',
      'BE-2025-006',
      'Anna-Lena Schmidt',
      'Übungsleiterpauschale 1. Quartal 2025',
      '-600.00',
      'Ausgabe',
      '3. Zweckbetrieb',
      'Sportbetrieb & Übungsleitervergütungen',
      '60040 - Übungsleiterpauschale (§ 3 Nr. 26 EStG)',
      primaryAcc,
      '0',
      'Steuerfreie Aufwandsentschädigung Tennis'
    ],
    [
      '15.02.2025',
      'BE-2025-007',
      'Autohaus Müller GmbH',
      'Bandenwerbung Hauptplatz Saison 2024/2025',
      '1200.00',
      'Einnahme',
      '4. Wirtschaftlicher Geschäftsbetrieb',
      'Werbung, Sponsoring & Marketing',
      '44100 - Bandenwerbung Sportplatz (19% USt)',
      primaryAcc,
      '19',
      'Rechnung #RE-2025-012 zzgl. 19% USt'
    ],
    [
      '20.02.2025',
      'BE-2025-008',
      'Zuschauer & Gäste',
      'Kiosk-Tageseinnahmen Heimspieltag Fußball',
      '420.00',
      'Einnahme',
      '4. Wirtschaftlicher Geschäftsbetrieb',
      'Bewirtung, Vereinsfeste & Basare',
      '43150 - Verkauf Getränke Kiosk (19% USt)',
      cashAcc,
      '19',
      'Bargeld Kassensturz Kiosk'
    ],
    [
      '22.02.2025',
      'BE-2025-009',
      'Metro Großmarkt',
      'Wareneinkauf Getränke & Grillgut Heimspiel',
      '-230.00',
      'Ausgabe',
      '4. Wirtschaftlicher Geschäftsbetrieb',
      'Wareneinkauf & Bewirtungsaufwand',
      '51100 - Wareneinkauf Getränke (19% Vorsteuer)',
      cashAcc,
      '19',
      'Kassenbon #MB-48910 Vorsteuer 19%'
    ]
  ];

  const escapeCSV = (val: string) => {
    if (val.includes(';') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvLines = [
    headers.map(escapeCSV).join(';'),
    ...rows.map(row => row.map(escapeCSV).join(';'))
  ];

  return csvLines.join('\r\n');
}
