import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import {
  Member,
  Transaction,
  FinancialAccount,
  ClubSettings,
  TaxSphere,
  ClubContact,
  InventoryItem
} from '../types';
import { TAX_SPHERES } from '../data/taxSpheres';
import { CONTACT_TYPE_MAP } from '../data/contactConstants';
import { saveBlobWithLocationPicker, FileSaveResult } from '../utils/fileExportHelper';

export const ExportService = {
  // 1. Export Members to CSV with location picker & fallback
  async exportMembersCSV(members: Member[], filename = 'mitgliederliste.csv'): Promise<FileSaveResult> {
    const data = members.map(m => ({
      'Mitgliedsnummer': m.memberNumber,
      'Nachname': m.lastName,
      'Vorname': m.firstName,
      'Geschlecht': m.gender === 'm' ? 'Männlich' : m.gender === 'w' ? 'Weiblich' : m.gender === 'd' ? 'Divers' : 'Keine Angabe',
      'Geburtsdatum': m.birthDate || '',
      'Straße': m.address.street,
      'Hausnummer': m.address.houseNumber,
      'PLZ': m.address.zip,
      'Ort': m.address.city,
      'Land': m.address.country,
      'Telefon': m.phone,
      'E-Mail': m.email,
      'Eintrittsdatum': m.entryDate,
      'Austrittsdatum': m.exitDate || '',
      'Status': m.status === 'active' ? 'Aktiv' : m.status === 'passive' ? 'Passiv' : m.status === 'honorary' ? 'Ehrenmitglied' : m.status === 'terminated' ? 'Gekündigt' : 'Ruhend',
      'Abteilung': m.department,
      'Mitgliedschaftstyp': m.membershipType === 'full' ? 'Vollmitglied' : m.membershipType === 'reduced' ? 'Ermäßigt' : m.membershipType === 'youth' ? 'Jugend' : m.membershipType === 'family' ? 'Familie' : m.membershipType === 'supporting' ? 'Fördermitglied' : m.membershipType === 'honorary' ? 'Ehrenmitglied' : m.membershipType === 'ausgetreten' || m.membershipType === 'terminated' ? 'Ausgetreten' : m.membershipType,
      'Beitrag (EUR)': m.feeAmount.toFixed(2),
      'Zahlungsweise': m.feePeriod === 'monthly' ? 'Monatlich' : m.feePeriod === 'quarterly' ? 'Vierteljährlich' : m.feePeriod === 'half_yearly' ? 'Halbjährlich' : m.feePeriod === 'none' ? 'Beitragsfrei' : 'Jährlich',
      'Zahlungsmethode': m.paymentMethod === 'exempt' ? 'Beitragsfrei' : m.paymentMethod === 'sepa' ? 'SEPA-Lastschrift' : m.paymentMethod === 'transfer' ? 'Überweisung' : m.paymentMethod === 'cash' ? 'Bar' : 'Dauerauftrag',
      'IBAN': m.bankDetails.iban,
      'BIC': m.bankDetails.bic,
      'Bankname': m.bankDetails.bankName,
      'Kontoinhaber': m.bankDetails.accountHolder,
      'Mandatsdatum': m.bankDetails.mandateDate,
      'Mandatsreferenz': m.bankDetails.mandateReference,
      'DSGVO-Einwilligung': m.dataPrivacyConsent ? 'Ja' : 'Nein',
      'Notizen': m.notes.replace(/(\r\n|\n|\r)/gm, ' ')
    }));

    const csv = Papa.unparse(data, { delimiter: ';' });
    // Add UTF-8 BOM for Microsoft Excel compatibility
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    return await saveBlobWithLocationPicker(blob, filename, {
      description: 'CSV-Tabelle (*.csv)',
      mimeType: 'text/csv',
      extension: '.csv'
    });
  },

  // 2. Export Members to PDF with location picker & fallback
  async exportMembersPDF(members: Member[], settings: ClubSettings, title = 'Mitgliederliste', filename?: string): Promise<FileSaveResult> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Header
    doc.setFontSize(18);
    doc.setTextColor(20, 30, 50);
    doc.text(settings.clubName, 14, 15);

    doc.setFontSize(12);
    doc.setTextColor(100, 110, 120);
    doc.text(title, 14, 22);

    doc.setFontSize(9);
    doc.text(`Stand: ${new Date().toLocaleDateString('de-DE')} | Gesamt: ${members.length} Mitglieder`, 200, 22, { align: 'right' });

    // Divider
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.5);
    doc.line(14, 25, 283, 25);

    const tableRows = members.map(m => [
      m.memberNumber,
      `${m.lastName}, ${m.firstName}`,
      m.department,
      m.status === 'active' ? 'Aktiv' : m.status === 'passive' ? 'Passiv' : m.status === 'honorary' ? 'Ehre' : m.status === 'terminated' ? 'Gekündigt' : 'Ruhend',
      m.phone || '–',
      m.email || '–',
      `${m.address.zip} ${m.address.city}`,
      m.entryDate ? new Date(m.entryDate).toLocaleDateString('de-DE') : '–',
      `${m.feeAmount.toFixed(2)} € / ${m.feePeriod === 'yearly' ? 'J.' : m.feePeriod === 'none' ? 'Frei' : 'M.'}`,
      m.paymentMethod === 'exempt' ? 'Frei' : m.paymentMethod === 'sepa' ? 'SEPA' : m.paymentMethod === 'transfer' ? 'Überw.' : 'Bar'
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Nr.', 'Name, Vorname', 'Abteilung', 'Status', 'Telefon', 'E-Mail', 'Wohnort', 'Eintritt', 'Beitrag', 'Zahlung']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 2
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [40, 40, 40]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 40 },
        2: { cellWidth: 26 },
        3: { cellWidth: 18 },
        4: { cellWidth: 28 },
        5: { cellWidth: 44 },
        6: { cellWidth: 32 },
        7: { cellWidth: 20 },
        8: { cellWidth: 23 },
        9: { cellWidth: 18 }
      },
      didDrawPage: (data) => {
        // Footer
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(
          `Seite ${data.pageNumber} | ${settings.clubName} - Vertrauliche Mitgliederdaten gem. DSGVO`,
          14,
          doc.internal.pageSize.height - 8
        );
      }
    });

    const pdfBlob = doc.output('blob');
    const targetFilename = filename || `mitglieder_${new Date().toISOString().split('T')[0]}.pdf`;
    return await saveBlobWithLocationPicker(pdfBlob, targetFilename, {
      description: 'PDF-Dokument (*.pdf)',
      mimeType: 'application/pdf',
      extension: '.pdf'
    });
  },

  // 3. Single Member Sheet / Stammblatt with SEPA & DSGVO
  async exportMemberStammblattPDF(member: Member, settings: ClubSettings): Promise<FileSaveResult> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Club Header
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(settings.clubName, 14, 18);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${settings.address} | ${settings.email}`, 14, 24);
    doc.text(`${settings.associationNumber} | Steuernummer: ${settings.taxNumber}`, 14, 29);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(14, 33, 196, 33);

    // Title
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('Mitglieder-Stammblatt & Datennachweis', 14, 42);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 196, 42, { align: 'right' });

    // 1. Basisdaten Section
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 48, 182, 7, 'F');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('1. Persönliche Stammdaten', 16, 53);

    const baseData = [
      ['Mitgliedsnummer:', member.memberNumber, 'Status:', member.status.toUpperCase()],
      ['Vollständiger Name:', `${member.firstName} ${member.lastName}`, 'Geschlecht:', member.gender === 'm' ? 'Männlich' : member.gender === 'w' ? 'Weiblich' : member.gender === 'd' ? 'Divers' : '–'],
      ['Geburtsdatum:', member.birthDate ? new Date(member.birthDate).toLocaleDateString('de-DE') : '–', 'Abteilung:', member.department],
      ['Straße / Hausnr.:', `${member.address.street} ${member.address.houseNumber}`, 'Eintrittsdatum:', member.entryDate ? new Date(member.entryDate).toLocaleDateString('de-DE') : '–'],
      ['PLZ / Wohnort:', `${member.address.zip} ${member.address.city}`, 'Austrittsdatum:', member.exitDate ? new Date(member.exitDate).toLocaleDateString('de-DE') : '–'],
      ['Telefonnummer:', member.phone || '–', 'E-Mail-Adresse:', member.email || '–']
    ];

    autoTable(doc, {
      startY: 57,
      body: baseData,
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 1.5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 35, textColor: [71, 85, 105] },
        1: { cellWidth: 55 },
        2: { fontStyle: 'bold', cellWidth: 35, textColor: [71, 85, 105] },
        3: { cellWidth: 55 }
      }
    });

    const currentY1 = (doc as any).lastAutoTable.finalY + 6;

    // 2. Beitrags- & Zahlungsdaten Section
    doc.setFillColor(241, 245, 249);
    doc.rect(14, currentY1, 182, 7, 'F');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('2. Beitrags- & Zahlungsmodalitäten', 16, currentY1 + 5);

    const paymentData = [
      ['Mitgliedschaftstyp:', member.membershipType.toUpperCase(), 'Beitragshöhe:', `${member.feeAmount.toFixed(2)} €`],
      ['Zahlungsrhythmus:', member.feePeriod === 'yearly' ? 'Jährlich' : member.feePeriod === 'half_yearly' ? 'Halbjährlich' : member.feePeriod === 'quarterly' ? 'Vierteljährlich' : 'Monatlich', 'Zahlungsmethode:', member.paymentMethod.toUpperCase()],
      ['Kontoinhaber:', member.bankDetails.accountHolder || '–', 'Kreditinstitut:', member.bankDetails.bankName || '–'],
      ['IBAN:', member.bankDetails.iban || '–', 'BIC:', member.bankDetails.bic || '–'],
      ['SEPA-Mandatsreferenz:', member.bankDetails.mandateReference || '–', 'Mandatsdatum:', member.bankDetails.mandateDate ? new Date(member.bankDetails.mandateDate).toLocaleDateString('de-DE') : '–']
    ];

    autoTable(doc, {
      startY: currentY1 + 9,
      body: paymentData,
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 1.5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 38, textColor: [71, 85, 105] },
        1: { cellWidth: 52 },
        2: { fontStyle: 'bold', cellWidth: 35, textColor: [71, 85, 105] },
        3: { cellWidth: 55 }
      }
    });

    const currentY2 = (doc as any).lastAutoTable.finalY + 6;

    // 3. Notizen & Datenschutz
    doc.setFillColor(241, 245, 249);
    doc.rect(14, currentY2, 182, 7, 'F');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('3. Notizen & Datenschutzhinweis (DSGVO Art. 13/14)', 16, currentY2 + 5);

    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Interne Notizen: ${member.notes || 'Keine besonderen Vermerke.'}`, 16, currentY2 + 12, { maxWidth: 178 });

    doc.text(
      `Datenschutzstatus: Das Mitglied hat der zweckgebundenen Erhebung, Speicherung und Verarbeitung der oben genannten Daten für Zwecke der Vereinsverwaltung und satzungsgemäßen Betreuung gem. Art. 6 Abs. 1 lit. b DSGVO zugestimmt. (${member.dataPrivacyConsent ? 'Einwilligung erteilt' : 'Keine gesonderte Einwilligung'})`,
      16,
      currentY2 + 22,
      { maxWidth: 178 }
    );

    // Signature Area
    const signY = currentY2 + 45;
    doc.setDrawColor(180, 180, 180);
    doc.line(16, signY, 85, signY);
    doc.line(115, signY, 184, signY);

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Ort, Datum', 16, signY + 4);
    doc.text('Unterschrift Mitglied / Gesetzl. Vertreter', 115, signY + 4);

    const pdfBlob = doc.output('blob');
    const filename = `stammblatt_${member.memberNumber}_${member.lastName}.pdf`;
    return await saveBlobWithLocationPicker(pdfBlob, filename, {
      description: 'PDF-Dokument (*.pdf)',
      mimeType: 'application/pdf',
      extension: '.pdf'
    });
  },

  // 4. Transactions CSV Export
  exportTransactionsCSV(transactions: Transaction[], accounts: FinancialAccount[], filename = 'buchungen.csv'): void {
    const accMap = new Map(accounts.map(a => [a.id, a.name]));

    const data = transactions.map(t => ({
      'Buchungs-ID': t.id,
      'Datum': t.date,
      'Belegnummer': t.documentNumber,
      'Buchungstext': t.bookingText,
      'Zahlungspartner': t.partner,
      'Konto': accMap.get(t.accountId) || t.accountId,
      'Steuerliche Sphäre': TAX_SPHERES[t.sphere]?.name || t.sphere,
      'Kategorie': t.category,
      'Betrag (EUR)': t.amount.toFixed(2),
      'Typ': t.type === 'income' ? 'Einnahme' : t.type === 'expense' ? 'Ausgabe' : 'Umbuchung',
      'USt-Satz (%)': t.vatRate,
      'Beleg vorhanden': t.receipt ? 'Ja' : 'Nein',
      'Notizen': (t.notes || '').replace(/(\r\n|\n|\r)/gm, ' ')
    }));

    const csv = Papa.unparse(data, { delimiter: ';' });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // 4b. Transactions Journal PDF Export
  exportTransactionsPDF(
    transactions: Transaction[],
    accounts: FinancialAccount[],
    settings: ClubSettings,
    title = 'Buchungsjournal',
    filename?: string
  ): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const accMap = new Map(accounts.map(a => [a.id, a.name]));

    // Header
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(settings.clubName || 'Sportverein e.V.', 14, 15);

    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text(title, 14, 21);

    doc.setFontSize(8.5);
    doc.text(
      `Stand: ${new Date().toLocaleDateString('de-DE')} | ${transactions.length} Buchung(en)`,
      283,
      21,
      { align: 'right' }
    );

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 24, 283, 24);

    let totalAmount = 0;
    const tableRows = transactions.map(t => {
      totalAmount += t.amount;
      const isIncome = t.amount >= 0;
      const amountStr = `${isIncome ? '+' : ''}${t.amount.toFixed(2)} €`;
      const sphereName = TAX_SPHERES[t.sphere]?.name || t.sphere;

      return [
        new Date(t.date).toLocaleDateString('de-DE'),
        t.documentNumber || '–',
        t.partner || '–',
        t.bookingText || '–',
        accMap.get(t.accountId) || t.accountId,
        sphereName,
        t.category || '–',
        t.receipt ? 'Ja' : 'Nein',
        amountStr
      ];
    });

    autoTable(doc, {
      startY: 27,
      head: [['Datum', 'Beleg-Nr.', 'Partner', 'Buchungstext', 'Konto', 'Sphäre', 'Kategorie', 'Beleg', 'Betrag (€)']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 2
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        textColor: [30, 41, 59]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 24, fontStyle: 'bold' },
        2: { cellWidth: 42 },
        3: { cellWidth: 50 },
        4: { cellWidth: 32 },
        5: { cellWidth: 35 },
        6: { cellWidth: 36 },
        7: { cellWidth: 14, halign: 'center' },
        8: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
      },
      foot: [
        [
          { content: `GESAMTSUMME (${transactions.length} Buchungen):`, colSpan: 8, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249], textColor: [15, 23, 42] } },
          { content: `${totalAmount >= 0 ? '+' : ''}${totalAmount.toFixed(2)} €`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249], textColor: totalAmount >= 0 ? [16, 185, 129] : [225, 29, 72] } }
        ]
      ],
      didDrawPage: (data) => {
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Seite ${data.pageNumber} | ${settings.clubName} - Buchungsjournal & GoBD-Archiv`,
          14,
          doc.internal.pageSize.height - 8
        );
      }
    });

    const targetFile = filename || `buchungsjournal_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(targetFile);
  },

  // 4c. Inventory CSV Export
  exportInventoryCSV(items: InventoryItem[], filename = 'inventarliste.csv'): void {
    const conditionLabels: Record<string, string> = {
      new: 'Neu / Neuwertig',
      good: 'Gut / Einsatzbereit',
      used: 'Gebraucht',
      damaged: 'Beschädigt',
      in_repair: 'In Reparatur',
      discarded: 'Ausgemustert'
    };

    const data = items.map(item => ({
      'Inventar-Nr.': item.itemNumber,
      'Bezeichnung': item.name,
      'Kategorie': item.category,
      'Sparte / Abteilung': item.department,
      'Menge': item.quantity,
      'Einheit': item.unit,
      'Standort': item.location,
      'Zustand': conditionLabels[item.condition] || item.condition,
      'Anschaffungsdatum': item.purchaseDate || '',
      'Anschaffungspreis (EUR)': item.purchasePrice !== undefined ? item.purchasePrice.toFixed(2) : '',
      'Aktueller Zeitwert (EUR)': item.currentValue !== undefined ? item.currentValue.toFixed(2) : '',
      'Lieferant / Hersteller': item.supplier || '',
      'Zuständige Person': item.responsiblePerson || '',
      'Zugewiesen / Einsatz bei': item.assignedTo || '',
      'Seriennummer': item.serialNumber || '',
      'Letzte Prüfung': item.lastCheckedDate || '',
      'Nächste Prüfung': item.nextInspectionDate || '',
      'Notizen': (item.notes || '').replace(/(\r\n|\n|\r)/gm, ' ')
    }));

    const csv = Papa.unparse(data, { delimiter: ';' });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // 4d. Inventory PDF Export
  exportInventoryPDF(
    items: InventoryItem[],
    settings: ClubSettings,
    title = 'Inventar- & Materialliste',
    filename?: string
  ): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const conditionLabels: Record<string, string> = {
      new: 'Neu',
      good: 'Gut',
      used: 'Gebraucht',
      damaged: 'Defekt',
      in_repair: 'Reparatur',
      discarded: 'Ausgemustert'
    };

    // Header
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(settings.clubName || 'Sportverein e.V.', 14, 15);

    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text(title, 14, 21);

    doc.setFontSize(8.5);
    doc.text(
      `Stand: ${new Date().toLocaleDateString('de-DE')} | ${items.length} Gegenstände`,
      283,
      21,
      { align: 'right' }
    );

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 24, 283, 24);

    let totalValue = 0;
    const tableRows = items.map(item => {
      const val = item.currentValue !== undefined ? item.currentValue : item.purchasePrice || 0;
      totalValue += val;
      const valStr = val > 0 ? `${val.toFixed(2)} €` : '–';

      return [
        item.itemNumber || '–',
        item.name,
        item.department,
        `${item.quantity} ${item.unit}`,
        item.location || '–',
        conditionLabels[item.condition] || item.condition,
        valStr,
        item.responsiblePerson || item.assignedTo || '–',
        item.nextInspectionDate || '–'
      ];
    });

    autoTable(doc, {
      startY: 27,
      head: [['Inventar-Nr.', 'Gegenstand', 'Abteilung', 'Menge', 'Standort', 'Zustand', 'Zeitwert (€)', 'Verantwortlich', 'Nächste Prüf.']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 2
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        textColor: [30, 41, 59]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 26, fontStyle: 'bold' },
        1: { cellWidth: 60 },
        2: { cellWidth: 32 },
        3: { cellWidth: 20 },
        4: { cellWidth: 42 },
        5: { cellWidth: 24 },
        6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 36 },
        8: { cellWidth: 22, halign: 'center' }
      },
      foot: [
        [
          { content: `GESAMTWERT (${items.length} Gegenstände):`, colSpan: 6, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249], textColor: [15, 23, 42] } },
          { content: `${totalValue.toFixed(2)} €`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249], textColor: [15, 23, 42] } },
          { content: '', colSpan: 2, styles: { fillColor: [241, 245, 249] } }
        ]
      ],
      didDrawPage: (data) => {
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Seite ${data.pageNumber} | ${settings.clubName} - Inventarverzeichnis & Sachanlagen`,
          14,
          doc.internal.pageSize.height - 8
        );
      }
    });

    const targetFile = filename || `inventarliste_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(targetFile);
  },

  // 5. Gewinn- und Verlustrechnung (GuV / EÜR) PDF Export nach § 4 Abs. 3 EStG / 4 steuerliche Sphären
  exportGuvPDF(
    transactions: Transaction[],
    settings: ClubSettings,
    yearFilter?: string
  ): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Filter transactions if year provided
    const txs = yearFilter && yearFilter !== 'all'
      ? transactions.filter(t => t.date.startsWith(yearFilter))
      : transactions;

    const titlePeriod = yearFilter && yearFilter !== 'all' ? `Geschäftsjahr ${yearFilter}` : 'Gesamter Zeitraum';

    // Header
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(settings.clubName, 14, 16);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${settings.associationNumber} | Steuernummer: ${settings.taxNumber}`, 14, 21);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(14, 24, 196, 24);

    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(`Einnahmen-Überschuss-Rechnung (EÜR / GuV)`, 14, 32);

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Gegliedert nach den 4 steuerlichen Sphären gem. §§ 51 ff. AO | ${titlePeriod}`, 14, 38);

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 196, 38, { align: 'right' });

    // Calculate totals for each sphere
    const spheres: TaxSphere[] = ['ideell', 'vermoegen', 'zweckbetrieb', 'wirtschaftlich'];
    const sphereResults: Record<TaxSphere, { income: number; expense: number; net: number; details: Record<string, { income: number; expense: number }> }> = {
      ideell: { income: 0, expense: 0, net: 0, details: {} },
      vermoegen: { income: 0, expense: 0, net: 0, details: {} },
      zweckbetrieb: { income: 0, expense: 0, net: 0, details: {} },
      wirtschaftlich: { income: 0, expense: 0, net: 0, details: {} }
    };

    txs.forEach(t => {
      if (t.type === 'transfer') return; // Skip internal transfers in GuV
      const sph = t.sphere || 'ideell';
      if (!sphereResults[sph].details[t.category]) {
        sphereResults[sph].details[t.category] = { income: 0, expense: 0 };
      }

      if (t.amount >= 0) {
        sphereResults[sph].income += t.amount;
        sphereResults[sph].details[t.category].income += t.amount;
      } else {
        sphereResults[sph].expense += Math.abs(t.amount);
        sphereResults[sph].details[t.category].expense += Math.abs(t.amount);
      }
      sphereResults[sph].net = sphereResults[sph].income - sphereResults[sph].expense;
    });

    let totalIncome = 0;
    let totalExpense = 0;
    spheres.forEach(s => {
      totalIncome += sphereResults[s].income;
      totalExpense += sphereResults[s].expense;
    });
    const totalNet = totalIncome - totalExpense;

    // Table rows
    const rows: any[] = [];

    spheres.forEach(sph => {
      const info = TAX_SPHERES[sph];
      const res = sphereResults[sph];

      // Sphere Header row
      rows.push([
        { content: info.name, colSpan: 3, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] } },
        { content: `${res.net >= 0 ? '+' : ''}${res.net.toFixed(2)} €`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right', textColor: res.net >= 0 ? [16, 185, 129] : [225, 29, 72] } }
      ]);

      // Category breakdown
      const categories = Object.keys(res.details);
      if (categories.length === 0) {
        rows.push(['', '  (Keine Buchungen in dieser Periode)', '', '0,00 €']);
      } else {
        categories.forEach(cat => {
          const c = res.details[cat];
          if (c.income > 0) {
            rows.push(['', `  + Einnahme: ${cat}`, `${c.income.toFixed(2)} €`, '']);
          }
          if (c.expense > 0) {
            rows.push(['', `  - Ausgabe: ${cat}`, `-${c.expense.toFixed(2)} €`, '']);
          }
        });
      }

      // Sphere Subtotal
      rows.push([
        '',
        { content: `Zwischensumme ${info.name}:`, styles: { fontStyle: 'italic', textColor: [100, 116, 139] } },
        { content: `Einn: ${res.income.toFixed(2)} € | Ausg: ${res.expense.toFixed(2)} €`, styles: { fontStyle: 'italic', textColor: [100, 116, 139] } },
        { content: `Saldo: ${res.net.toFixed(2)} €`, styles: { fontStyle: 'bold', halign: 'right' } }
      ]);
    });

    // Grand Total Row
    rows.push([
      { content: 'GESAMTERGEBNIS (JAHRESÜBERSCHUSS / FEHLBETRAG)', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9 } },
      { content: `E: ${totalIncome.toFixed(2)} € | A: ${totalExpense.toFixed(2)} €`, styles: { fontStyle: 'bold', fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8.5 } },
      { content: `${totalNet >= 0 ? '+' : ''}${totalNet.toFixed(2)} €`, styles: { fontStyle: 'bold', fillColor: [30, 41, 59], textColor: [255, 255, 255], halign: 'right', fontSize: 10 } }
    ]);

    autoTable(doc, {
      startY: 42,
      head: [['Sphäre', 'Kategorie / Posten', 'Teilbetrag', 'Saldo']],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 1.8
      },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 78 },
        2: { cellWidth: 36, halign: 'right' },
        3: { cellWidth: 26, halign: 'right' }
      },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(
          `Seite ${data.pageNumber} | ${settings.clubName} - Vorlage zur Vorlage bei der Mitgliederversammlung / Finanzamt`,
          14,
          doc.internal.pageSize.height - 8
        );
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 14;
    if (finalY < 260) {
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Die Richtigkeit und Vollständigkeit der Buchführung wird bestätigt:', 14, finalY);

      doc.setDrawColor(180, 180, 180);
      doc.line(14, finalY + 18, 70, finalY + 18);
      doc.line(120, finalY + 18, 180, finalY + 18);

      doc.setFontSize(7.5);
      doc.text(`Ort, Datum (${new Date().toLocaleDateString('de-DE')})`, 14, finalY + 22);
      doc.text(`Kassenprüfer / 1. Vorsitzender`, 120, finalY + 22);
    }

    doc.save(`EStG_GuV_${yearFilter || 'gesamt'}_${new Date().toISOString().split('T')[0]}.pdf`);
  },

  // 6. Export Contacts to CSV
  exportContactsCSV(contacts: ClubContact[], filename = 'kontakte.csv'): void {
    const data = contacts.map(c => {
      const typeLabels = (c.types || [])
        .map(t => CONTACT_TYPE_MAP.get(t)?.label || t)
        .join(', ');

      return {
        'Kontaktnummer': c.contactNumber,
        'Personenart': c.personType === 'legal' ? 'Juristische Person (Firma / Organisation)' : 'Natürliche Person',
        'Name / Firma': c.displayName,
        'Rechtsform': c.legalForm || '',
        'Kontakttypen': typeLabels,
        'Ansprechpartner': c.personType === 'legal' && c.contactPerson
          ? [c.contactPerson.salutation, c.contactPerson.firstName, c.contactPerson.lastName, c.contactPerson.roleOrPosition ? `(${c.contactPerson.roleOrPosition})` : '']
              .filter(Boolean)
              .join(' ')
          : '',
        'Steuernummer / USt-ID': c.taxId || '',
        'Handelsregister': c.commercialRegister || '',
        'E-Mail': c.email,
        'Telefon': c.phone,
        'Mobil': c.mobile || '',
        'Website': c.website || '',
        'Straße': c.address.street,
        'Hausnummer': c.address.houseNumber,
        'PLZ': c.address.zip,
        'Ort': c.address.city,
        'Land': c.address.country,
        'IBAN': c.bankDetails?.iban || '',
        'BIC': c.bankDetails?.bic || '',
        'Bankname': c.bankDetails?.bankName || '',
        'Kontoinhaber': c.bankDetails?.accountHolder || '',
        'Kreditoren-/Debitorennr.': c.creditorOrDebtorNumber || '',
        'Notizen': (c.notes || '').replace(/(\r\n|\n|\r)/gm, ' '),
        'Schlagwörter': (c.tags || []).join(', ')
      };
    });

    const csv = Papa.unparse(data, { delimiter: ';' });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // 7. Export Contacts to PDF
  exportContactsPDF(contacts: ClubContact[], clubName = 'Verein', title = 'Kontaktliste'): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Header
    doc.setFontSize(18);
    doc.setTextColor(20, 30, 50);
    doc.text(clubName, 14, 15);

    doc.setFontSize(12);
    doc.setTextColor(100, 110, 120);
    doc.text(title, 14, 22);

    doc.setFontSize(9);
    doc.text(`Stand: ${new Date().toLocaleDateString('de-DE')} | Gesamt: ${contacts.length} Kontakte`, 283, 22, { align: 'right' });

    // Divider
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.5);
    doc.line(14, 25, 283, 25);

    const tableRows = contacts.map(c => {
      const typeLabels = (c.types || [])
        .map(t => CONTACT_TYPE_MAP.get(t)?.label || t)
        .join(', ');

      const ap = c.personType === 'legal' && c.contactPerson
        ? `${c.contactPerson.lastName}, ${c.contactPerson.firstName || ''}${c.contactPerson.roleOrPosition ? ` (${c.contactPerson.roleOrPosition})` : ''}`.trim()
        : '–';

      const location = [c.address?.zip, c.address?.city].filter(Boolean).join(' ') || '–';

      return [
        c.contactNumber || '–',
        c.displayName + (c.legalForm ? ` (${c.legalForm})` : ''),
        c.personType === 'legal' ? 'Firma' : 'Privat',
        typeLabels || '–',
        ap,
        c.phone || c.mobile || '–',
        c.email || '–',
        location,
        c.bankDetails?.iban ? `${c.bankDetails.iban.slice(0, 8)}...` : '–'
      ];
    });

    autoTable(doc, {
      startY: 28,
      head: [['Nr.', 'Name / Firma', 'Art', 'Rolle(n)', 'Ansprechpartner', 'Telefon', 'E-Mail', 'Ort', 'IBAN']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 2
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [40, 40, 40]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 44 },
        2: { cellWidth: 16 },
        3: { cellWidth: 38 },
        4: { cellWidth: 36 },
        5: { cellWidth: 26 },
        6: { cellWidth: 42 },
        7: { cellWidth: 26 },
        8: { cellWidth: 23 }
      },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(
          `Seite ${data.pageNumber} | ${clubName} - Vertrauliche Geschäftspartner- & Kontaktdaten gem. DSGVO`,
          14,
          doc.internal.pageSize.height - 8
        );
      }
    });

    doc.save(`kontakte_${new Date().toISOString().split('T')[0]}.pdf`);
  }
};
