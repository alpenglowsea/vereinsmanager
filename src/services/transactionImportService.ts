import { Transaction, TaxSphere, FinancialAccount, ClubSettings } from '../types';
import { SKR42_STRUCTURE, TAX_SPHERES } from '../data/taxSpheres';

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
}

/**
 * Universal CSV / TSV / Tab-Separated Clipboard Parser
 * Handles Excel, Google Sheets, Quotes, Semicolons, Commas, Tabs, multiline strings and BOM
 */
export function parseCSVToRows(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Strip BOM if present
  let cleanText = text.replace(/^\uFEFF/, '').trim();
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
export function autoDetectTransactionMapping(headers: string[]): TransactionColumnMapping {
  const mapping: TransactionColumnMapping = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');

  const rules: { key: keyof TransactionColumnMapping; aliases: string[] }[] = [
    {
      key: 'date',
      aliases: [
        'datum', 'buchungsdatum', 'belegdatum', 'wertstellung', 'valuta', 'date', 'buchungstag', 'transaktionsdatum'
      ]
    },
    {
      key: 'documentNumber',
      aliases: [
        'belegnummer', 'belegnr', 'beleg', 'docnr', 'rechnungsnummer', 'rechnungsnr', 'ref', 'buchungsnummer',
        'belegnummerintern', 'belegdokument', 'nr'
      ]
    },
    {
      key: 'partner',
      aliases: [
        'partner', 'zahlungspartner', 'empfänger', 'begünstigter', 'auftraggeber', 'empfaenger', 'beguenstigter',
        'auftraggebername', 'kontoinhaber', 'name', 'gegenpartei', 'mitglied', 'kunde', 'lieferant', 'debitor',
        'kreditor', 'payee', 'absender', 'person'
      ]
    },
    {
      key: 'bookingText',
      aliases: [
        'buchungstext', 'verwendungszweck', 'beschreibung', 'text', 'betreff', 'vorgang', 'zweck', 'memo',
        'details', 'description', 'vermerk', 'umsatztext', 'buchungsbeschreibung'
      ]
    },
    {
      key: 'amount',
      aliases: [
        'betrag', 'umsatz', 'summe', 'wert', 'eur', 'amount', 'zahlbetrag', 'gesamtbetrag', 'bruttobetrag',
        'nettobetrag', 'euro', 'betrageur', 'betragineur', 'wertineur'
      ]
    },
    {
      key: 'type',
      aliases: [
        'typ', 'buchungsart', 'art', 'sollhaben', 'sh', 'einnahmeausgabe', 'type', 'vorgangsart'
      ]
    },
    {
      key: 'sphere',
      aliases: [
        'sphäre', 'sphaere', 'steuerlichesphäre', 'steuerbereich', 'bereich', 'skr42sphäre', 'sphärenbereich',
        'tätigkeitsbereich', 'sphere', 'sphärenteil'
      ]
    },
    {
      key: 'category',
      aliases: [
        'hauptkategorie', 'kategorie', 'kostenart', 'erlösart', 'eürkategorie', 'guvkategorie', 'skrkategorie',
        'category', 'kategoriebezeichnung', 'kontenbereich'
      ]
    },
    {
      key: 'subCategory',
      aliases: [
        'nebenkategorie', 'unterkategorie', 'skr42konto', 'skrkonto', 'kontonummer', 'buchungskonto',
        'sachkonto', 'skr42', 'kontoart', 'skr', 'unterkonto', 'subcategory'
      ]
    },
    {
      key: 'account',
      aliases: [
        'konto', 'bankkonto', 'finanzkonto', 'kasse', 'zahlweg', 'bank', 'gegenkonto', 'account', 'zahlungskonto'
      ]
    },
    {
      key: 'vatRate',
      aliases: [
        'mwst', 'ust', 'steuersatz', 'mehrwertsteuer', 'umsatzsteuer', 'ustsatz', 'mwstsatz', 'taxrate', 'steuer'
      ]
    },
    {
      key: 'notes',
      aliases: [
        'notizen', 'bemerkung', 'anmerkung', 'kommentar', 'intern', 'notes', 'hinweis', 'memo'
      ]
    }
  ];

  headers.forEach(header => {
    const norm = normalize(header);
    for (const rule of rules) {
      if (!mapping[rule.key]) {
        const match = rule.aliases.some(alias => norm === alias || norm.includes(alias));
        if (match) {
          mapping[rule.key] = header;
          break;
        }
      }
    }
  });

  return mapping;
}

/**
 * Intelligent Number & Amount Parser supporting:
 * - 1.234,56 €
 * - -123,45
 * - 123.45 (US)
 * - (50.00) (Accounting parentheses for negative)
 * - 50,00 S (Soll = negative / expense)
 * - 50,00 H (Haben = positive / income)
 */
export function parseAmountValue(rawVal: string, typeVal?: string): { amount: number; isExpense: boolean } {
  if (!rawVal) return { amount: 0, isExpense: false };

  let str = rawVal.trim();
  let forceNegative = false;
  let forcePositive = false;

  // Check accounting trailing or leading indicators
  if (str.endsWith('S') || str.endsWith('s') || str.startsWith('S ') || str.startsWith('-')) {
    forceNegative = true;
  } else if (str.endsWith('H') || str.endsWith('h') || str.startsWith('H ') || str.startsWith('+')) {
    forcePositive = true;
  }

  // Parentheses check e.g. (100.00)
  if (str.startsWith('(') && str.endsWith(')')) {
    forceNegative = true;
    str = str.slice(1, -1);
  }

  // Remove currency, spaces, S/H letters
  str = str.replace(/[€$£a-zA-Z\s]/g, '');

  let num = 0;
  if (str.includes(',') && str.includes('.')) {
    // German format e.g. 1.234,56 or US format 1,234.56
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      // German: 1.234,56
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 1,234.56
      str = str.replace(/,/g, '');
    }
    num = parseFloat(str) || 0;
  } else if (str.includes(',')) {
    // German decimal: 123,45
    str = str.replace(',', '.');
    num = parseFloat(str) || 0;
  } else {
    // Standard: 123.45 or 1234
    num = parseFloat(str) || 0;
  }

  // Type string heuristics e.g. "Ausgabe", "Abgang", "Expense", "Debit", "Lastschrift", "Einnahme", "Gutschrift"
  if (typeVal) {
    const t = typeVal.toLowerCase();
    if (t.includes('ausgabe') || t.includes('abgang') || t.includes('expense') || t.includes('debit') || t.includes('lastschrift') || t.includes('soll')) {
      forceNegative = true;
      forcePositive = false;
    } else if (t.includes('einnahme') || t.includes('zugang') || t.includes('income') || t.includes('credit') || t.includes('gutschrift') || t.includes('haben')) {
      forcePositive = true;
      forceNegative = false;
    }
  }

  if (forceNegative) {
    num = -Math.abs(num);
  } else if (forcePositive) {
    num = Math.abs(num);
  }

  return {
    amount: num,
    isExpense: num < 0
  };
}

/**
 * Intelligent Date Parser supporting:
 * - DD.MM.YYYY
 * - YYYY-MM-DD
 * - DD/MM/YYYY
 * - DD-MM-YYYY
 * - MM/DD/YYYY
 */
export function parseDateValue(rawVal: string): string {
  if (!rawVal) return new Date().toISOString().split('T')[0];

  const trimmed = rawVal.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // DD.MM.YYYY or D.M.YYYY
  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotMatch) {
    const day = dotMatch[1].padStart(2, '0');
    const month = dotMatch[2].padStart(2, '0');
    let year = dotMatch[3];
    if (year.length === 2) {
      year = parseInt(year, 10) > 50 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    let year = slashMatch[3];
    if (year.length === 2) {
      year = parseInt(year, 10) > 50 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // Fallback to Date object parsing
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

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
 * Intelligent Category & SKR 42 SubCategory matcher
 */
export function resolveSKR42Category(
  sphere: TaxSphere,
  isIncome: boolean,
  rawCat: string,
  rawSubCat: string,
  bookingText: string
): { category: string; subCategory: string } {
  const type = isIncome ? 'income' : 'expense';
  const availableMainCats = SKR42_STRUCTURE.filter(c => c.sphere === sphere && c.type === type);

  if (availableMainCats.length === 0) {
    return {
      category: rawCat || (isIncome ? 'Sonstige Einnahmen' : 'Sonstige Ausgaben'),
      subCategory: rawSubCat || ''
    };
  }

  // 1. Direct match by subcategory code or name
  if (rawSubCat) {
    const rawLower = rawSubCat.toLowerCase();
    for (const main of availableMainCats) {
      for (const sub of main.subCategories) {
        if (sub.code === rawSubCat || rawLower.includes(sub.code) || sub.name.toLowerCase().includes(rawLower) || rawLower.includes(sub.name.toLowerCase())) {
          return { category: main.name, subCategory: sub.label };
        }
      }
    }
  }

  // 2. Direct match by main category name
  if (rawCat) {
    const catLower = rawCat.toLowerCase();
    for (const main of availableMainCats) {
      if (main.name.toLowerCase().includes(catLower) || catLower.includes(main.name.toLowerCase())) {
        const firstSub = main.subCategories[0];
        return { category: main.name, subCategory: firstSub ? firstSub.label : '' };
      }
    }
  }

  // 3. Fallback: match by booking text keywords
  const textLower = `${bookingText} ${rawCat} ${rawSubCat}`.toLowerCase();
  for (const main of availableMainCats) {
    for (const sub of main.subCategories) {
      const keywords = sub.name.toLowerCase().split(/[\s,/-]+/);
      const match = keywords.some(k => k.length > 3 && textLower.includes(k));
      if (match) {
        return { category: main.name, subCategory: sub.label };
      }
    }
  }

  // Default to first available main category & subcategory for this sphere
  const defaultMain = availableMainCats[0];
  const defaultSub = defaultMain?.subCategories[0];
  return {
    category: rawCat || (defaultMain ? defaultMain.name : 'Allgemeine Buchung'),
    subCategory: rawSubCat || (defaultSub ? defaultSub.label : '')
  };
}

/**
 * Convert parsed CSV/Sheets rows to rich Transaction objects with full validation & duplicate check
 */
export function convertRowsToTransactions(
  rows: Record<string, string>[],
  mapping: TransactionColumnMapping,
  existingTransactions: Transaction[],
  accounts: FinancialAccount[],
  settings: ClubSettings,
  defaultAccountId: string,
  defaultSphere: TaxSphere,
  defaultVatRate: 0 | 7 | 19 = 0
): ParsedTransactionRow[] {
  const currentYear = new Date().getFullYear();
  let runningDocIndex = 1;

  // Find max doc number index for current year to auto-generate missing doc numbers
  existingTransactions.forEach(t => {
    const m = t.documentNumber.match(/BE-\d{4}-(\d+)/i);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num >= runningDocIndex) runningDocIndex = num + 1;
    }
  });

  const accountNameToIdMap = new Map<string, string>();
  accounts.forEach(acc => {
    accountNameToIdMap.set(acc.id.toLowerCase(), acc.id);
    accountNameToIdMap.set(acc.name.toLowerCase(), acc.id);
    if (acc.iban) accountNameToIdMap.set(acc.iban.toLowerCase().replace(/\s/g, ''), acc.id);
  });

  return rows.map((row, index) => {
    const warnings: string[] = [];
    const id = `tx-imp-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`;

    // 1. Date
    const rawDate = mapping.date ? row[mapping.date] || '' : '';
    const date = parseDateValue(rawDate);
    if (!rawDate) warnings.push('Datum fehlte in der Datei (auf heute gesetzt)');

    // 2. Amount & Type
    const rawAmount = mapping.amount ? row[mapping.amount] || '' : '';
    const rawType = mapping.type ? row[mapping.type] || '' : '';
    const { amount, isExpense } = parseAmountValue(rawAmount, rawType);
    if (amount === 0) warnings.push('Betrag ist 0,00 € oder konnte nicht eindeutig gelesen werden');

    const txType: 'income' | 'expense' | 'transfer' = amount >= 0 ? 'income' : 'expense';

    // 3. Document Number
    let docNum = mapping.documentNumber ? (row[mapping.documentNumber] || '').trim() : '';
    if (!docNum) {
      docNum = `BE-${currentYear}-${(runningDocIndex++).toString().padStart(3, '0')}`;
    }

    // 4. Partner & Booking text
    const partner = mapping.partner ? (row[mapping.partner] || '').trim() : '';
    const bookingText = mapping.bookingText ? (row[mapping.bookingText] || '').trim() : '';

    if (!partner && !bookingText) {
      warnings.push('Weder Partner noch Buchungstext vorhanden');
    }

    // 5. Account resolution
    let accountId = defaultAccountId || accounts[0]?.id || 'acc-1';
    if (mapping.account && row[mapping.account]) {
      const rawAcc = row[mapping.account].trim().toLowerCase().replace(/\s/g, '');
      if (accountNameToIdMap.has(rawAcc)) {
        accountId = accountNameToIdMap.get(rawAcc)!;
      }
    }

    // 6. Tax Sphere
    const rawSphere = mapping.sphere ? row[mapping.sphere] || '' : '';
    const rawCat = mapping.category ? row[mapping.category] || '' : '';
    const rawSubCat = mapping.subCategory ? row[mapping.subCategory] || '' : '';

    let sphere: TaxSphere = defaultSphere;
    if (rawSphere) {
      sphere = detectTaxSphere(rawSphere, rawCat, rawSubCat, bookingText);
    } else {
      sphere = detectTaxSphere('', rawCat, rawSubCat, bookingText);
    }

    // 7. Category & Subcategory (SKR 42)
    const { category, subCategory } = resolveSKR42Category(
      sphere,
      !isExpense,
      rawCat,
      rawSubCat,
      bookingText
    );

    // 8. Tax Rate (MwSt / USt)
    let vatRate: 0 | 7 | 19 = defaultVatRate;
    if (mapping.vatRate && row[mapping.vatRate]) {
      const rawVat = row[mapping.vatRate].replace(/[^0-9]/g, '');
      const parsedVat = parseInt(rawVat, 10);
      if (parsedVat === 7) {
        vatRate = 7;
      } else if (parsedVat === 19) {
        vatRate = 19;
      } else {
        vatRate = 0;
      }
    }

    // 9. Notes
    const notes = mapping.notes ? (row[mapping.notes] || '').trim() : '';

    // 10. Duplicate Check against existing database transactions
    let isDuplicate = false;
    let existingTransactionId: string | undefined = undefined;

    const duplicateMatch = existingTransactions.find(t => {
      // Check date match and exact amount
      const sameDate = t.date === date;
      const sameAmount = Math.abs(t.amount - amount) < 0.009;
      if (!sameDate || !sameAmount) return false;

      // Check partner or document number or booking text similarity
      const sameDocNum = docNum && t.documentNumber.toLowerCase() === docNum.toLowerCase();
      const samePartner = partner && t.partner.toLowerCase() === partner.toLowerCase();
      const sameText = bookingText && t.bookingText.toLowerCase() === bookingText.toLowerCase();

      return sameDocNum || samePartner || sameText;
    });

    if (duplicateMatch) {
      isDuplicate = true;
      existingTransactionId = duplicateMatch.id;
      warnings.push(`Mögliches Duplikat zu Beleg "${duplicateMatch.documentNumber}" (${duplicateMatch.date}, ${duplicateMatch.partner || duplicateMatch.bookingText})`);
    }

    const createdTx: Transaction = {
      id,
      date,
      amount,
      type: txType,
      accountId,
      documentNumber: docNum,
      bookingText: bookingText || (partner ? `Zahlung ${partner}` : 'Importierte Buchung'),
      partner: partner || 'Sonstiger Partner',
      sphere,
      category,
      subCategory,
      vatRate,
      notes: notes ? `${notes} (Excel/Sheets Import)` : 'Importiert aus Excel / Google Sheets',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return {
      id,
      selected: !isDuplicate,
      raw: row,
      hasWarnings: warnings.length > 0,
      warnings,
      isDuplicate,
      existingTransactionId,
      transaction: createdTx
    };
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
    'Hauptkategorie',
    'Nebenkategorie (SKR 42)',
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
      '3110 - Laufende Mitgliedsbeiträge',
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
      '3210 - Geldspenden (steuerbegünstigt)',
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
      '5110 - Verbandsbeiträge Landessportbund',
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
      '3510 - Zinserträge Bankguthaben',
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
      '4120 - Start- & Meldegelder',
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
      '6510 - Übungsleiterpauschalen (§ 3 Nr. 26 EStG)',
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
      '4510 - Banden- & Bannerwerbung',
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
      '4620 - Einnahmen Kiosk & Vereinsheim',
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
      '7110 - Wareneinkauf Speisen & Getränke',
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
