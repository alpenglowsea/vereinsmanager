import Papa from 'papaparse';
import { Transaction, TaxSphere } from '../types';

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

  // Parse German date (DD.MM.YYYY or YYYY-MM-DD)
  parseDate(dateStr: string): string {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const trimmed = dateStr.trim();
    if (trimmed.includes('.')) {
      const parts = trimmed.split('.');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = '20' + year;
        return `${year}-${month}-${day}`;
      }
    }
    if (trimmed.includes('-')) {
      return trimmed.substring(0, 10);
    }
    return new Date().toISOString().split('T')[0];
  },

  // Parse German number (e.g. "1.250,50" or "-45,00" or "45.00")
  parseGermanNumber(numStr: string | number): number {
    if (typeof numStr === 'number') return numStr;
    if (!numStr) return 0;
    let s = String(numStr).trim().replace(/\s/g, '').replace(/€/g, '');
    
    // Check if it's German format with thousand dot and decimal comma
    if (s.includes(',') && s.includes('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    
    const parsed = parseFloat(s);
    return isNaN(parsed) ? 0 : parsed;
  },

  // Parse generic German Bank CSV (Sparkasse, Volksbank, VR-NetWorld, Postbank, Commerzbank, etc.)
  parseBankCSV(fileContent: string): Promise<ParsedBankRow[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: '', // auto-detect delimiter (, or ; or tab)
        complete: (results) => {
          try {
            const rows = results.data as Record<string, string>[];
            if (!rows || rows.length === 0) {
              resolve([]);
              return;
            }

            // Detect headers
            const sample = rows[0];
            const keys = Object.keys(sample);

            // Find matching column names
            const dateKey = keys.find(k => /buchungstag|datum|valutadatum|tag|date|buchungsdatum/i.test(k)) || keys[0];
            const amountKey = keys.find(k => /betrag|umsatz|betrag in eur|amount/i.test(k));
            const partnerKey = keys.find(k => /beguenstigter|begünstigter|zahlungsempfänger|auftraggeber|name|partner|absender/i.test(k));
            const textKey = keys.find(k => /verwendungszweck|buchungstext|notiz|text|verwendungszweckzeile/i.test(k));
            const ibanKey = keys.find(k => /iban|kontonummer/i.test(k));

            const parsedRows: ParsedBankRow[] = [];

            rows.forEach((row, idx) => {
              const rawDate = row[dateKey] || '';
              const rawAmount = amountKey ? row[amountKey] : '0';
              const rawPartner = partnerKey ? row[partnerKey] : '';
              const rawText = textKey ? row[textKey] : '';
              const rawIban = ibanKey ? row[ibanKey] : '';

              if (!rawDate && !rawAmount) return;

              const date = BankImportService.parseDate(rawDate);
              const amount = BankImportService.parseGermanNumber(rawAmount);
              const partner = (rawPartner || 'Unbekannter Partner').trim();
              const bookingText = (rawText || (partner !== 'Unbekannter Partner' ? partner : 'Banküberweisung')).trim();

              const combinedText = `${partner} ${bookingText}`;
              const { sphere, category } = BankImportService.guessSphereAndCategory(combinedText, amount);

              parsedRows.push({
                id: `bank-row-${idx}-${Date.now()}`,
                date,
                amount,
                partner,
                bookingText,
                iban: rawIban,
                suggestedSphere: sphere,
                suggestedCategory: category,
                selected: true
              });
            });

            resolve(parsedRows);
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
    startDocIndex = 1
  ): Transaction[] {
    const year = new Date().getFullYear();
    return rows.filter(r => r.selected).map((r, i) => {
      const docNum = `BK-${year}-${String(startDocIndex + i).padStart(3, '0')}`;
      const isIncome = r.amount >= 0;

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
        category: r.suggestedCategory,
        vatRate: r.suggestedSphere === 'wirtschaftlich' ? 19 : r.suggestedSphere === 'zweckbetrieb' ? 7 : 0,
        notes: `Importiert aus Bankauszug. IBAN: ${r.iban || '–'}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });
  }
};
