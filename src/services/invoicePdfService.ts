import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { ClubInvoice, ClubSettings, InvoiceTemplateSettings, ClubDocument } from '../types';
import { DEFAULT_INVOICE_TEMPLATE } from '../data/initialInvoices';

/**
 * Zeichnet den GiroCode (EPC-QR-Code) direkt mit Vektor-Rechtecken in das PDF.
 * Dadurch werden PNG-Alpha-Kanal-Konvertierungsfehler und Farbverfälschungen (braune Box) vermieden,
 * und der QR-Code bleibt in jeder Vergrößerung und jedem PDF-Reader messerscharf und zuverlässig scannbar.
 */
function drawVectorGiroCode(
  doc: jsPDF,
  settings: ClubSettings,
  invoice: ClubInvoice,
  x: number,
  y: number,
  size: number
): boolean {
  try {
    const iban = (settings.creditorIban || '').replace(/\s+/g, '').toUpperCase();
    const bic = (settings.creditorBic || '').replace(/\s+/g, '').toUpperCase();
    const recipient = settings.clubName.substring(0, 70);
    const amount = invoice.totalAmount.toFixed(2);
    const reference = invoice.invoiceNumber.substring(0, 35);

    if (!iban) return false;

    // Standard EPC-QR-Code Format nach European Payments Council (EPC069-12)
    const epcPayload = [
      'BCD',
      '002',
      '1',
      'SCT',
      bic,
      recipient,
      iban,
      `EUR${amount}`,
      '',
      reference,
      '',
      'Rechnungsbegleichung'
    ].join('\n');

    const qr = QRCode.create(epcPayload, {
      errorCorrectionLevel: 'M'
    });

    // 1. Reines weißes Badge mit feiner Kontur für perfekten Kontrast
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, size, size, 1, 1, 'FD');

    // 2. QR-Code Module als Vektoren in tiefem Schwarz zeichnen
    doc.setFillColor(0, 0, 0);
    const moduleCount = qr.modules.size;
    const margin = 2; // Ruhezone / Quiet zone
    const totalModules = moduleCount + margin * 2;
    const moduleSize = size / totalModules;

    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (qr.modules.get(r, c)) {
          doc.rect(
            x + (c + margin) * moduleSize,
            y + (r + margin) * moduleSize,
            moduleSize + 0.04, // Leichter Überlapp verhindert Subpixel-Haarlinien
            moduleSize + 0.04,
            'F'
          );
        }
      }
    }

    return true;
  } catch (err) {
    console.warn('Vector GiroCode generation failed:', err);
    return false;
  }
}

/**
 * Formatiert Geldbeträge nach deutschem Standard (z.B. 1.250,50 €)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

/**
 * Formatiert Datumsangaben (YYYY-MM-DD -> DD.MM.YYYY)
 */
export function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

export const InvoicePdfService = {
  /**
   * Erzeugt das vollständige Rechnungs-PDF (DIN 5008 konform)
   * Unterstützt benutzerdefinierte Blanko-Vorlagen (Briefpapier als Hintergrund)
   */
  async generateInvoicePdf(
    invoice: ClubInvoice,
    settings: ClubSettings,
    template: InvoiceTemplateSettings = DEFAULT_INVOICE_TEMPLATE
  ): Promise<jsPDF> {
    // DIN A4: 210mm x 297mm
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const hasCustomBlanko = Boolean(template.customBlankoDataUrl && template.customBlankoDataUrl.trim().length > 0);

    // 1. Hintergrund: Falls eine eigene Blanko-Vorlage hochgeladen wurde, als ganzseitigen Hintergrund zeichnen
    if (hasCustomBlanko && template.customBlankoDataUrl) {
      try {
        doc.addImage(template.customBlankoDataUrl, 'PNG', 0, 0, 210, 297);
      } catch (e) {
        try {
          doc.addImage(template.customBlankoDataUrl, 'JPEG', 0, 0, 210, 297);
        } catch (err2) {
          console.error('Failed to render custom blanko letterhead background:', err2);
        }
      }
    } else {
      // 2. Standard Vereinsbriefkopf zeichnen (wenn keine Blanko-Vorlage vorliegt)
      // Vereinsname & Kopfzeile
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(30, 64, 175); // Blue-800
      doc.text(settings.clubName, 20, 22);

      // Zierschnitt / Farbstreifen oben
      doc.setDrawColor(30, 64, 175);
      doc.setLineWidth(1.2);
      doc.line(20, 26, 190, 26);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${settings.associationNumber || ''} • ${settings.taxOffice || 'Finanzamt'} • St.-Nr.: ${settings.taxNumber || ''}`,
        20,
        31
      );

      // Falt- und Lochmarken (DIN 5008)
      if (template.showFoldingMarks) {
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        // Lochmarke Mitte
        doc.line(4, 148.5, 9, 148.5);
        // Faltmarke 1 (105mm)
        doc.line(4, 105, 8, 105);
        // Faltmarke 2 (210mm)
        doc.line(4, 210, 8, 210);
      }
    }

    // 3. Absenderzeile über dem Adressfeld (DIN 5008 Fensterbrief: 5mm über Adressfeld, ca. Y=45mm)
    if (!hasCustomBlanko) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const returnAddress = `${settings.clubName} • ${settings.address} • ${settings.email || ''}`;
      doc.text(returnAddress, 20, 48);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(20, 49.5, 105, 49.5);
    }

    // 4. Empfänger-Adressfeld (DIN 5008 Fenster: 85mm x 45mm, startet ca. Y=53mm)
    const addrY = hasCustomBlanko ? Math.max(template.marginTop, 52) : 53;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42); // Slate-900

    let currentAddrY = addrY;
    if (invoice.recipientCompany) {
      doc.setFont('helvetica', 'bold');
      doc.text(invoice.recipientCompany, 20, currentAddrY);
      currentAddrY += 4.8;
      doc.setFont('helvetica', 'normal');
    }

    if (invoice.recipientContactPerson) {
      doc.text(invoice.recipientContactPerson, 20, currentAddrY);
      currentAddrY += 4.8;
    } else if (invoice.recipientName && invoice.recipientName !== invoice.recipientCompany) {
      doc.text(invoice.recipientName, 20, currentAddrY);
      currentAddrY += 4.8;
    }

    if (invoice.recipientAddress?.street) {
      doc.text(
        `${invoice.recipientAddress.street} ${invoice.recipientAddress.houseNumber || ''}`.trim(),
        20,
        currentAddrY
      );
      currentAddrY += 4.8;
    }

    if (invoice.recipientAddress?.zip || invoice.recipientAddress?.city) {
      doc.text(
        `${invoice.recipientAddress.zip || ''} ${invoice.recipientAddress.city || ''}`.trim(),
        20,
        currentAddrY
      );
      currentAddrY += 4.8;
    }

    if (invoice.recipientAddress?.country && invoice.recipientAddress.country.toLowerCase() !== 'deutschland') {
      doc.text(invoice.recipientAddress.country.toUpperCase(), 20, currentAddrY);
    }

    // 5. Rechnungs-Metadaten-Block (Rechts ausgerichtet)
    const metaX = 135;
    const metaY = hasCustomBlanko ? Math.max(template.marginTop, 50) : 52;

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);

    const metaItems: { label: string; value: string; bold?: boolean }[] = [
      { label: 'Rechnungsnummer:', value: invoice.invoiceNumber, bold: true },
      { label: 'Rechnungsdatum:', value: formatDate(invoice.date) },
      { label: 'Leistungsdatum:', value: formatDate(invoice.deliveryDate || invoice.date) },
      { label: 'Fälligkeitsdatum:', value: formatDate(invoice.dueDate), bold: true },
      {
        label: 'Kundennummer / Ref.:',
        value: invoice.recipientId || (invoice.recipientType === 'member' ? 'Mitglied' : 'Geschäftspartner')
      }
    ];

    let currentMetaY = metaY;
    metaItems.forEach(item => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(item.label, metaX, currentMetaY);

      doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(item.value, 190, currentMetaY, { align: 'right' });
      currentMetaY += 4.8;
    });

    // 6. Betreffzeile / Rechnungstitel
    let contentY = Math.max(currentAddrY + 12, currentMetaY + 10, 96);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(`${invoice.title || 'Rechnung'} Nr. ${invoice.invoiceNumber}`, 20, contentY);

    if (invoice.subject) {
      contentY += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`Betreff: ${invoice.subject}`, 20, contentY);
    }

    // 7. Einleitungstext
    if (invoice.introText) {
      contentY += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      const splitIntro = doc.splitTextToSize(invoice.introText, 170);
      doc.text(splitIntro, 20, contentY);
      contentY += splitIntro.length * 4.5 + 4;
    } else {
      contentY += 6;
    }

    // 8. Rechnungspositionen Tabelle (autoTable)
    const tableHeaders = [['Pos.', 'Bezeichnung / Beschreibung', 'Menge', 'Einzelpreis', 'Gesamtpreis']];
    const tableBody = invoice.items.map((item, idx) => [
      item.position || idx + 1,
      item.description,
      `${item.quantity.toLocaleString('de-DE')} ${item.unit || 'Stk.'}`,
      formatCurrency(item.unitPrice),
      formatCurrency(item.totalPrice)
    ]);

    autoTable(doc, {
      startY: contentY,
      head: tableHeaders,
      body: tableBody,
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 2.8,
        textColor: [15, 23, 42],
        lineColor: [226, 232, 240],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [51, 65, 85],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      columnStyles: {
        0: { cellWidth: 14, halign: 'center' },
        1: { cellWidth: 'auto', halign: 'left' },
        2: { cellWidth: 26, halign: 'right' },
        3: { cellWidth: 26, halign: 'right' },
        4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 20, right: 20 }
    });

    // 9. Summenblock (Netto, MwSt. je Satz, Brutto)
    const lastTableY = (doc as any).lastAutoTable.finalY || contentY + 30;
    let totalsY = lastTableY + 4;

    const summaryBoxX = 115;
    const summaryBoxWidth = 75;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(summaryBoxX, totalsY, 190, totalsY);
    totalsY += 4.5;

    // Summe Netto
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Summe Netto:', summaryBoxX, totalsY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrency(invoice.subtotalNet), 190, totalsY, { align: 'right' });
    totalsY += 4.5;

    // USt nach Sätzen aufschlüsseln
    if (invoice.vatAmounts && Object.keys(invoice.vatAmounts).length > 0) {
      Object.entries(invoice.vatAmounts).forEach(([rate, amount]) => {
        const numRate = Number(rate);
        const label = numRate === 0 ? 'zzgl. 0% USt (steuerbefreit):' : `zzgl. ${numRate}% USt:`;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(label, summaryBoxX, totalsY);
        doc.setTextColor(15, 23, 42);
        doc.text(formatCurrency(amount), 190, totalsY, { align: 'right' });
        totalsY += 4.5;
      });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('zzgl. USt:', summaryBoxX, totalsY);
      doc.text(formatCurrency(invoice.totalVat || 0), 190, totalsY, { align: 'right' });
      totalsY += 4.5;
    }

    // Fette Trennlinie vor Gesamtbetrag
    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(0.8);
    doc.line(summaryBoxX, totalsY, 190, totalsY);
    totalsY += 5;

    // Gesamtbetrag (Hervorgehoben)
    doc.setFillColor(241, 245, 249);
    doc.rect(summaryBoxX - 2, totalsY - 4, summaryBoxWidth + 4, 8, 'F');

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('Gesamtbetrag (Zahlbetrag):', summaryBoxX, totalsY + 1.5);
    doc.text(formatCurrency(invoice.totalAmount), 190, totalsY + 1.5, { align: 'right' });

    totalsY += 12;

    // 10. Schlusstext / Zahlungsziel
    if (invoice.outroText) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const splitOutro = doc.splitTextToSize(invoice.outroText, 170);
      doc.text(splitOutro, 20, totalsY);
      totalsY += splitOutro.length * 4.2 + 4;
    }

    // 11. Bankverbindung & GiroCode Zahlungsbox
    if (template.showGiroCode && settings.creditorIban) {
      // Zahlungsbox Rahmen
      const boxY = Math.min(totalsY, 235);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.roundedRect(20, boxY, 170, 28, 2, 2, 'FD');

      // GiroCode QR als hochpräzise Vektorgrafik zeichnen (verhindert Alpha-Kanal/Farbfehler)
      const qrRendered = drawVectorGiroCode(doc, settings, invoice, 23, boxY + 2, 24);

      // Bank- und Überweisungstext
      const textX = qrRendered ? 51 : 25;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Zahlungsinformationen & GiroCode (SEPA-Überweisung)', textX, boxY + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Empfänger: ${settings.clubName}  •  Kreditinstitut: ${settings.taxOffice ? 'Sparkasse / Hausbank' : ''}`,
        textX,
        boxY + 10.5
      );
      doc.text(
        `IBAN: ${settings.creditorIban || '-'}   BIC: ${settings.creditorBic || '-'}`,
        textX,
        boxY + 15
      );
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text(
        `Verwendungszweck: ${invoice.invoiceNumber}  •  Fällig bis: ${formatDate(invoice.dueDate)}`,
        textX,
        boxY + 19.5
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('Mit Ihrer Banking-App scannen, um alle Zahlungsdaten sekundenschnell zu übernehmen.', textX, boxY + 24);
    }

    // 12. Standard Fußzeile (wenn keine Blanko-Vorlage vorliegt)
    if (!hasCustomBlanko) {
      const footerY = 278;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(20, footerY, 190, footerY);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);

      // Spalte 1: Verein & Vorstand
      doc.text(`${settings.clubName}`, 20, footerY + 4);
      doc.text(`1. Vorsitzender: ${settings.chairman || '-'}`, 20, footerY + 7.5);
      doc.text(`Kassier/Schatzmeister: ${settings.treasurer || '-'}`, 20, footerY + 11);

      // Spalte 2: Register & Steuern
      doc.text(`Register: ${settings.associationNumber || '-'}`, 80, footerY + 4);
      doc.text(`Steuernummer: ${settings.taxNumber || '-'}`, 80, footerY + 7.5);
      doc.text(`Finanzamt: ${settings.taxOffice || '-'}`, 80, footerY + 11);

      // Spalte 3: Bankverbindung
      doc.text(`IBAN: ${settings.creditorIban || '-'}`, 140, footerY + 4);
      doc.text(`BIC: ${settings.creditorBic || '-'}`, 140, footerY + 7.5);
      doc.text(`Gläubiger-ID: ${settings.creditorId || '-'}`, 140, footerY + 11);
    }

    return doc;
  },

  /**
   * Gibt das PDF als Base64-Data-URL zurück (z.B. für Vorschau oder Speicherung)
   */
  async getInvoicePdfDataUrl(
    invoice: ClubInvoice,
    settings: ClubSettings,
    template?: InvoiceTemplateSettings
  ): Promise<string> {
    const doc = await this.generateInvoicePdf(invoice, settings, template);
    return doc.output('datauristring');
  },

  /**
   * Lädt das PDF direkt im Browser herunter
   */
  async downloadInvoicePdf(
    invoice: ClubInvoice,
    settings: ClubSettings,
    template?: InvoiceTemplateSettings
  ): Promise<void> {
    const doc = await this.generateInvoicePdf(invoice, settings, template);
    const fileName = `Rechnung_${invoice.invoiceNumber}_${invoice.recipientName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    doc.save(fileName);
  },

  /**
   * Erzeugt ein ClubDocument für die direkte Ablage in der Dokumentenverwaltung
   */
  async createDocumentFromInvoice(
    invoice: ClubInvoice,
    settings: ClubSettings,
    template?: InvoiceTemplateSettings
  ): Promise<ClubDocument> {
    const dataUrl = await this.getInvoicePdfDataUrl(invoice, settings, template);
    const fileName = `Rechnung_${invoice.invoiceNumber}.pdf`;

    const newDoc: ClubDocument = {
      id: `doc-inv-${invoice.id}-${Date.now().toString(36)}`,
      title: `Ausgangsrechnung ${invoice.invoiceNumber} - ${invoice.recipientName}`,
      fileName,
      category: 'belege',
      date: invoice.date,
      fileSize: Math.round(dataUrl.length * 0.75),
      fileType: 'application/pdf',
      dataUrl,
      uploadDate: new Date().toISOString(),
      tags: ['Rechnung', 'Ausgangsrechnung', invoice.status, invoice.taxSphere || 'Finanzen'],
      notes: `Automatisch archivierte Ausgangsrechnung über ${formatCurrency(invoice.totalAmount)}. Status: ${invoice.status}`,
      memberId: invoice.recipientType === 'member' ? invoice.recipientId : undefined,
      memberName: invoice.recipientType === 'member' ? invoice.recipientName : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return newDoc;
  }
};

export const generateInvoicePdf = InvoicePdfService.generateInvoicePdf.bind(InvoicePdfService);
export const downloadInvoicePdf = InvoicePdfService.downloadInvoicePdf.bind(InvoicePdfService);
export const getInvoicePdfDataUrl = InvoicePdfService.getInvoicePdfDataUrl.bind(InvoicePdfService);
export const createDocumentFromInvoice = InvoicePdfService.createDocumentFromInvoice.bind(InvoicePdfService);
