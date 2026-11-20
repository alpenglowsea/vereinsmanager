import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { formatClubAddress } from '../utils/clubAddress';
import { ClubInvoice, ClubSettings, InvoiceTemplateSettings, ClubDocument } from '../types';
import { DEFAULT_INVOICE_TEMPLATE } from '../data/initialInvoices';
import { savePdfAs } from '../utils/fileExportHelper';
import { giroCodeInhalt, kontaktZeile, mengeText, KLEINUNTERNEHMER_HINWEIS } from './rechnungsRegeln';

/** „#1e40af“ → [30, 64, 175]; null bei ungültigem Wert. */
function hexZuRgb(hex: string | undefined): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Zeichnet den GiroCode (EPC-QR-Code) direkt mit Vektor-Rechtecken in das PDF.
 * Dadurch werden PNG-Alpha-Kanal-Konvertierungsfehler und Farbverfälschungen (braune Box) vermieden,
 * und der QR-Code bleibt in jeder Vergrößerung und jedem PDF-Reader messerscharf und zuverlässig scannbar.
 */
function drawVectorGiroCode(doc: jsPDF, epcPayload: string, x: number, y: number, size: number): boolean {
  try {
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
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const L = 20;
    const R = 190;
    const hasCustomBlanko = Boolean(template.customBlankoDataUrl && template.customBlankoDataUrl.trim().length > 0);
    const standard = !hasCustomBlanko;
    // Seitenränder für Inhalt; mit eigenem Briefpapier gilt der obere Rand der
    // Vorlage auch auf Folgeseiten (D-45, wie Android)
    const unten = standard ? 270 : 262;
    const oben = standard ? 30 : Math.max(template.marginTop || 0, 20);
    // Akzentfarbe der Vorlage (D-45); vorher fest Blau
    const akzent = hexZuRgb(template.accentColor) ?? [30, 64, 175];
    const setzeAkzentText = () => doc.setTextColor(akzent[0], akzent[1], akzent[2]);
    const setzeAkzentLinie = () => doc.setDrawColor(akzent[0], akzent[1], akzent[2]);
    const kleinunternehmer = Boolean(invoice.smallBusiness);

    const zeichneBriefpapier = () => {
      if (!hasCustomBlanko || !template.customBlankoDataUrl) return;
      try {
        doc.addImage(template.customBlankoDataUrl, 'PNG', 0, 0, 210, 297);
      } catch (_e) {
        // Erst PNG, dann JPEG; scheitert beides, steht es in der Konsole.
        try {
          doc.addImage(template.customBlankoDataUrl, 'JPEG', 0, 0, 210, 297);
        } catch (err2) {
          console.error('Failed to render custom blanko letterhead background:', err2);
        }
      }
    };

    let y = 0;
    const neueSeite = () => {
      doc.addPage();
      zeichneBriefpapier();
      y = oben;
    };
    /** Sorgt dafür, dass noch `hoehe` mm Platz sind, sonst neue Seite (vorher lief Inhalt über den Seitenrand). */
    const platz = (hoehe: number) => {
      if (y + hoehe > unten) neueSeite();
    };
    const text = (
      t: string,
      x: number,
      ty: number,
      size: number,
      opts: { bold?: boolean; color?: [number, number, number]; align?: 'left' | 'right' | 'center' } = {}
    ) => {
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      const c = opts.color ?? [15, 23, 42];
      doc.setTextColor(c[0], c[1], c[2]);
      doc.text(t, x, ty, opts.align ? { align: opts.align } : undefined);
    };
    const GRAU: [number, number, number] = [100, 116, 139];
    const MITTEL: [number, number, number] = [51, 65, 85];
    const SLATE: [number, number, number] = [71, 85, 105];

    // 1. Briefpapier bzw. Standard-Briefkopf
    if (hasCustomBlanko) {
      zeichneBriefpapier();
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      setzeAkzentText();
      doc.text(settings.clubName, L, 22);
      setzeAkzentLinie();
      doc.setLineWidth(1.2);
      doc.line(L, 26, R, 26);

      const kopf = [
        settings.associationNumber || '',
        settings.taxOffice || '',
        settings.taxNumber ? `St.-Nr.: ${settings.taxNumber}` : ''
      ].filter(Boolean);
      if (kopf.length > 0) text(kopf.join(' • '), L, 31, 8.5, { color: GRAU });
      // Telefon, E-Mail und Webseite des Vereins (E10)
      const kontakt = kontaktZeile(settings);
      if (kontakt) text(kontakt, L, 34.5, 8.5, { color: GRAU });

      // Falt- und Lochmarken (DIN 5008)
      if (template.showFoldingMarks) {
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(4, 148.5, 9, 148.5);
        doc.line(4, 105, 8, 105);
        doc.line(4, 210, 8, 210);
      }

      // Absenderzeile über dem Adressfeld
      const absender = [settings.clubName, formatClubAddress(settings.address), settings.email || '']
        .filter(t => t && t.trim())
        .join(' • ');
      text(absender, L, 48, 7.5, { color: GRAU });
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(L, 49.5, 105, 49.5);
    }

    // 2. Empfänger-Adressfeld (DIN 5008 Fenster)
    let ay = hasCustomBlanko ? Math.max(template.marginTop, 52) : 53;
    if (invoice.recipientCompany) {
      text(invoice.recipientCompany, L, ay, 10, { bold: true });
      ay += 4.8;
    }
    if (invoice.recipientContactPerson) {
      text(invoice.recipientContactPerson, L, ay, 10);
      ay += 4.8;
    } else if (invoice.recipientName && invoice.recipientName !== invoice.recipientCompany) {
      text(invoice.recipientName, L, ay, 10);
      ay += 4.8;
    }
    const strasse = `${invoice.recipientAddress?.street || ''} ${invoice.recipientAddress?.houseNumber || ''}`.trim();
    if (strasse) {
      text(strasse, L, ay, 10);
      ay += 4.8;
    }
    const ort = `${invoice.recipientAddress?.zip || ''} ${invoice.recipientAddress?.city || ''}`.trim();
    if (ort) {
      text(ort, L, ay, 10);
      ay += 4.8;
    }
    if (invoice.recipientAddress?.country && invoice.recipientAddress.country.toLowerCase() !== 'deutschland') {
      text(invoice.recipientAddress.country.toUpperCase(), L, ay, 10);
      ay += 4.8;
    }

    // 3. Rechnungsangaben rechts. Keine interne Kennung mehr: vorher stand
    // unter „Kundennummer / Ref.“ z. B. „member-1699…“ (D-50).
    let my = hasCustomBlanko ? Math.max(template.marginTop, 50) : 52;
    const meta: { label: string; value: string; bold?: boolean }[] = [
      { label: 'Rechnungsnummer:', value: invoice.invoiceNumber, bold: true },
      { label: 'Rechnungsdatum:', value: formatDate(invoice.date) },
      { label: 'Leistungsdatum:', value: formatDate(invoice.deliveryDate || invoice.date) },
      { label: 'Fälligkeitsdatum:', value: formatDate(invoice.dueDate), bold: true }
    ];
    for (const m of meta) {
      text(m.label, 135, my, 8.5, { color: GRAU });
      text(m.value, R, my, 8.5, { bold: m.bold, align: 'right' });
      my += 4.8;
    }

    // 4. Titel, Betreff, Einleitung
    y = Math.max(ay + 12, my + 10, 96);
    text(`${invoice.title || 'Rechnung'} Nr. ${invoice.invoiceNumber}`, L, y, 14, { bold: true });
    if (invoice.subject) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      for (const zeile of doc.splitTextToSize(`Betreff: ${invoice.subject}`, 170) as string[]) {
        y += 6;
        text(zeile, L, y, 10.5, { bold: true, color: MITTEL });
      }
    }
    y += 6;
    if (invoice.introText) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      for (const zeile of doc.splitTextToSize(invoice.introText, 170) as string[]) {
        platz(4.5);
        text(zeile, L, y, 9.5, { color: MITTEL });
        y += 4.5;
      }
      y += 4;
    }

    // 5. Positionen (autoTable bricht selbst um; Folgeseiten bekommen das Briefpapier)
    platz(21);
    autoTable(doc, {
      startY: y,
      head: [['Pos.', 'Bezeichnung / Beschreibung', 'Menge', 'Einzelpreis', 'Gesamtpreis']],
      body: invoice.items.map((item, idx) => [
        item.position || idx + 1,
        item.description,
        // bis zu drei Nachkommastellen (D-49)
        `${mengeText(Number(item.quantity) || 0)} ${item.unit || 'Stk.'}`,
        formatCurrency(item.unitPrice),
        formatCurrency(item.totalPrice)
      ]),
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 2.8,
        textColor: [15, 23, 42],
        lineColor: [226, 232, 240],
        lineWidth: 0.2
      },
      headStyles: { fillColor: [248, 250, 252], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 8.5 },
      columnStyles: {
        0: { cellWidth: 14, halign: 'center' },
        1: { cellWidth: 'auto', halign: 'left' },
        2: { cellWidth: 26, halign: 'right' },
        3: { cellWidth: 26, halign: 'right' },
        4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
      },
      showHead: 'everyPage',
      margin: { left: L, right: 210 - R, top: oben, bottom: 297 - unten },
      willDrawPage: data => {
        if (data.pageNumber > 1) zeichneBriefpapier();
      }
    });
    y = ((doc as any).lastAutoTable?.finalY || y + 30) + 4;

    // 6. Summen. Kleinunternehmer: nur der Gesamtbetrag, darunter der Hinweis (D-05)
    const sx = 115;
    const ustZeilen = kleinunternehmer ? 0 : 1 + Object.keys(invoice.vatAmounts || {}).length;
    platz(4.5 + ustZeilen * 4.5 + 5 + 12);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(sx, y, R, y);
    y += 4.5;
    if (!kleinunternehmer) {
      text('Summe Netto:', sx, y, 9, { color: SLATE });
      text(formatCurrency(invoice.subtotalNet), R, y, 9, { bold: true, align: 'right' });
      y += 4.5;
      const saetze = Object.entries(invoice.vatAmounts || {}).sort((a, b) => Number(a[0]) - Number(b[0]));
      for (const [rate, amount] of saetze) {
        const satz = Number(rate);
        text(satz === 0 ? 'zzgl. 0 % USt (steuerbefreit):' : `zzgl. ${satz} % USt:`, sx, y, 9, { color: SLATE });
        text(formatCurrency(amount), R, y, 9, { align: 'right' });
        y += 4.5;
      }
    }
    setzeAkzentLinie();
    doc.setLineWidth(0.8);
    doc.line(sx, y, R, y);
    y += 5;
    doc.setFillColor(241, 245, 249);
    doc.rect(sx - 2, y - 4, 79, 8, 'F');
    text('Gesamtbetrag (Zahlbetrag):', sx, y + 1.5, 10.5, { bold: true, color: akzent });
    text(formatCurrency(invoice.totalAmount), R, y + 1.5, 10.5, { bold: true, color: akzent, align: 'right' });
    y += 12;

    if (kleinunternehmer) {
      const hinweis = (template.smallBusinessNotice ?? KLEINUNTERNEHMER_HINWEIS).trim();
      if (hinweis) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        for (const zeile of doc.splitTextToSize(hinweis, 170) as string[]) {
          platz(4.2);
          text(zeile, L, y, 9, { color: MITTEL });
          y += 4.2;
        }
        y += 3;
      }
    }

    // 7. Schlusstext
    if (invoice.outroText) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      for (const zeile of doc.splitTextToSize(invoice.outroText, 170) as string[]) {
        platz(4.2);
        text(zeile, L, y, 9, { color: MITTEL });
        y += 4.2;
      }
      y += 4;
    }

    // 8. Zahlungsbox mit GiroCode: direkt nach dem Inhalt, bei Platzmangel auf
    // der nächsten Seite (D-51). Vorher saß sie höchstens bei 235 mm und
    // konnte Text überdecken. Kein erfundener Bankname mehr (D-44).
    const epc = template.showGiroCode ? giroCodeInhalt(settings, invoice.totalAmount, `Rechnung ${invoice.invoiceNumber}`) : null;
    if (epc) {
      platz(30);
      const by = y;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.roundedRect(L, by, 170, 28, 2, 2, 'FD');
      const qr = drawVectorGiroCode(doc, epc, L + 3, by + 2, 24);
      const tx = qr ? 51 : 25;
      const iban = (settings.creditorIban || '').replace(/\s+/g, '').toUpperCase();
      const bic = (settings.creditorBic || '').replace(/\s+/g, '').toUpperCase();
      text('Zahlungsinformationen & GiroCode (SEPA-Überweisung)', tx, by + 5.5, 8.5, { bold: true });
      text(`Empfänger: ${settings.clubName}`, tx, by + 10.5, 8, { color: SLATE });
      text(`IBAN: ${iban}   BIC: ${bic || '-'}`, tx, by + 15, 8, { color: SLATE });
      text(`Verwendungszweck: Rechnung ${invoice.invoiceNumber}  •  Fällig bis: ${formatDate(invoice.dueDate)}`, tx, by + 19.5, 8, {
        bold: true,
        color: akzent
      });
      text('Mit Ihrer Banking-App scannen, um alle Zahlungsdaten zu übernehmen.', tx, by + 24, 7, { color: [148, 163, 184] });
      y += 30;
    }

    // 9. Fußzeile auf jeder Seite (ohne eigenes Briefpapier) und Seitenzahlen
    const seiten = doc.getNumberOfPages();
    for (let i = 1; i <= seiten; i++) {
      doc.setPage(i);
      if (standard) {
        const fy = 278;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(L, fy, R, fy);
        const f = (t: string, x: number, dy: number) => text(t, x, fy + dy, 7, { color: GRAU });
        f(settings.clubName, L, 4);
        f(`1. Vorsitzender: ${settings.chairman || '-'}`, L, 7.5);
        f(`Kassier/Schatzmeister: ${settings.treasurer || '-'}`, L, 11);
        f(`Register: ${settings.associationNumber || '-'}`, 80, 4);
        f(`Steuernummer: ${settings.taxNumber || '-'}`, 80, 7.5);
        f(`Finanzamt: ${settings.taxOffice || '-'}`, 80, 11);
        f(`IBAN: ${settings.creditorIban || '-'}`, 140, 4);
        f(`BIC: ${settings.creditorBic || '-'}`, 140, 7.5);
        f(`Gläubiger-ID: ${settings.creditorId || '-'}`, 140, 11);
      }
      if (seiten > 1) text(`Seite ${i} von ${seiten}`, R, standard ? 275 : 267, 7, { color: [148, 163, 184], align: 'right' });
    }
    doc.setPage(seiten);

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
    await savePdfAs(doc, fileName);
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
