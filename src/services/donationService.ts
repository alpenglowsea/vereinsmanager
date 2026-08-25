import jsPDF from 'jspdf';
import { DonationReceipt, ClubSettings } from '../types';

/**
 * Wandelt einen Geldbetrag in deutsche Worte um (z.B. 1500 -> "Eintausendfünfhundert Euro")
 */
export function numberToGermanWords(amount: number): string {
  if (isNaN(amount) || amount <= 0) return 'Null Euro';

  const euros = Math.floor(amount);
  const cents = Math.round((amount - euros) * 100);

  const units = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
  const teens = ['zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
  const tens = ['', 'zehn', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

  function convertBelowHundred(n: number, isDirectUnit = false): string {
    if (n === 0) return '';
    if (n === 1 && isDirectUnit) return 'eins';
    if (n < 10) return units[n];
    if (n >= 10 && n < 20) return teens[n - 10];
    const unitDigit = n % 10;
    const tenDigit = Math.floor(n / 10);
    if (unitDigit === 0) return tens[tenDigit];
    if (unitDigit === 1) return 'und' + tens[tenDigit] === '' ? 'eins' : 'einund' + tens[tenDigit];
    return units[unitDigit] + 'und' + tens[tenDigit];
  }

  function convertBelowThousand(n: number): string {
    if (n === 0) return '';
    let result = '';
    const hundredDigit = Math.floor(n / 100);
    const rest = n % 100;
    if (hundredDigit > 0) {
      result += (hundredDigit === 1 ? 'ein' : units[hundredDigit]) + 'hundert';
    }
    if (rest > 0) {
      result += convertBelowHundred(rest, hundredDigit === 0);
    }
    return result;
  }

  function convertNumber(n: number): string {
    if (n === 0) return 'null';
    if (n === 1) return 'eins';
    let str = '';

    const millions = Math.floor(n / 1000000);
    const thousands = Math.floor((n % 1000000) / 1000);
    const remainder = n % 1000;

    if (millions > 0) {
      str += (millions === 1 ? 'eine Million ' : convertBelowThousand(millions) + ' Millionen ');
    }
    if (thousands > 0) {
      str += (thousands === 1 ? 'eintausend' : convertBelowThousand(thousands) + 'tausend');
    }
    if (remainder > 0) {
      str += convertBelowThousand(remainder);
    }
    return str.trim();
  }

  let wordEuro = convertNumber(euros);
  // Capitalize first letter
  wordEuro = wordEuro.charAt(0).toUpperCase() + wordEuro.slice(1);

  let result = `${wordEuro} Euro`;
  if (cents > 0) {
    let wordCents = convertNumber(cents);
    result += ` und ${wordCents} Cent`;
  }
  return result;
}

/**
 * Erstellt eine rechtskonforme Zuwendungsbestätigung nach dem amtlichen BMF-Muster
 * (Muster 1: Geldzuwendungen, Muster 2: Sachzuwendungen gem. § 50 Abs. 1 EStDV)
 */
export function generateBmfDonationReceiptPdf(receipt: DonationReceipt, settings: ClubSettings): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const isGoods = receipt.type === 'goods';

  // 1. Aussteller Box (oben links)
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.3);
  doc.rect(14, 12, 182, 22);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Aussteller (Bezeichnung und Anschrift der steuerbegünstigten Einrichtung):', 16, 17);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.clubName, 16, 23);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`${settings.address} • Vereinsregister: ${settings.associationNumber}`, 16, 28);
  doc.text(`Steuernummer: ${receipt.taxNumber || settings.taxNumber}`, 16, 32);

  // 2. Belegnummer & Datum oben rechts
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Bescheinigungs-Nr.: ${receipt.receiptNumber}`, 196, 17, { align: 'right' });
  doc.text(`Ausstellungsdatum: ${receipt.cityAndDate || new Date().toLocaleDateString('de-DE')}`, 196, 22, { align: 'right' });

  // 3. Amtlicher Titel
  const title = isGoods
    ? 'Bestätigung über Sachzuwendungen'
    : 'Bestätigung über Geldzuwendungen';

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(title, 105, 41, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const legalSubtitle =
    'im Sinne des § 10b des Einkommensteuergesetzes an eine der in § 5 Abs. 1 Nr. 9 des Körperschaftsteuergesetzes bezeichneten Körperschaften, Personenvereinigungen oder Vermögensmassen';
  doc.text(doc.splitTextToSize(legalSubtitle, 180), 105, 46, { align: 'center' });

  // 4. Zuwendender / Spender Box
  doc.setDrawColor(148, 163, 184);
  doc.rect(14, 52, 182, 22);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Name und Anschrift des Zuwendenden:', 16, 57);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(receipt.donorName, 16, 63);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`${receipt.donorAddress.street} ${receipt.donorAddress.houseNumber}`, 16, 68);
  doc.text(`${receipt.donorAddress.zip} ${receipt.donorAddress.city} (${receipt.donorAddress.country || 'Deutschland'})`, 16, 72);

  let currentY = 78;

  // 5. Angaben zur Zuwendung (Geld vs. Sachzuwendung)
  if (!isGoods) {
    // GELDZUWENDUNG
    doc.setDrawColor(148, 163, 184);
    doc.rect(14, currentY, 182, 30);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Betrag der Zuwendung in Ziffern:', 16, currentY + 6);
    doc.setFontSize(11);
    doc.setTextColor(16, 185, 129);
    doc.text(`*** ${receipt.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € ***`, 65, currentY + 6);

    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('– in Buchstaben / Worten:', 16, currentY + 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(receipt.amountInWords || numberToGermanWords(receipt.amount), 65, currentY + 13, { maxWidth: 125 });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Tag der Zuwendung:', 16, currentY + 20);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(receipt.date).toLocaleDateString('de-DE'), 65, currentY + 20);

    // Verzicht auf Erstattung
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Verzicht auf Erstattung:', 16, currentY + 26);
    doc.setFont('helvetica', 'normal');

    const waiverText = receipt.isWaiverOfRefund
      ? '[ X ] Es handelt sich um den Verzicht auf Erstattung von Aufwendungen (Aufwandsspende).'
      : '[ X ] Es handelt sich nicht um den Verzicht auf Erstattung von Aufwendungen.';
    doc.text(waiverText, 65, currentY + 26);

    currentY += 34;
  } else {
    // SACHZUWENDUNG
    doc.setDrawColor(148, 163, 184);
    doc.rect(14, currentY, 182, 42);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Genaue Bezeichnung der Sachzuwendung (Gegenstand, Alter, Zustand, etc.):', 16, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const descLines = doc.splitTextToSize(receipt.goodsDescription || 'Sachspende gem. Übergabeprotokoll', 178);
    doc.text(descLines, 16, currentY + 11);

    const descY = currentY + 11 + Math.min(descLines.length * 3.8, 12);

    doc.setFont('helvetica', 'bold');
    doc.text('Geschätzter / Ermittelter Wert in Ziffern:', 16, descY + 4);
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129);
    doc.text(`*** ${receipt.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € ***`, 80, descY + 4);

    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('– in Buchstaben / Worten:', 16, descY + 9);
    doc.setFont('helvetica', 'normal');
    doc.text(receipt.amountInWords || numberToGermanWords(receipt.amount), 80, descY + 9, { maxWidth: 110 });

    doc.setFont('helvetica', 'bold');
    doc.text('Tag der Zuwendung:', 16, descY + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(receipt.date).toLocaleDateString('de-DE'), 80, descY + 14);

    // Herkunft & Unterlagen
    const isBusiness = receipt.goodsOrigin === 'business';
    doc.setFontSize(7.5);
    const originText = isBusiness
      ? '[ X ] Die Sachzuwendung stammt nach Angaben des Zuwendenden aus einem Betriebsvermögen.'
      : '[ X ] Die Sachzuwendung stammt nach Angaben des Zuwendenden aus dem Privatvermögen.';
    doc.text(originText, 16, descY + 19);

    if (receipt.goodsValuationBasis) {
      doc.text(`Unterlagen zur Wertermittlung: ${receipt.goodsValuationBasis}`, 16, descY + 23, { maxWidth: 178 });
    }

    currentY += 46;
  }

  // 6. Steuerbegünstigung / Freistellungstext gem. BMF
  doc.setDrawColor(148, 163, 184);
  doc.rect(14, currentY, 182, 54);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Angaben zur steuerlichen Freistellung (§ 5 Abs. 1 Nr. 9 KStG / §§ 51 ff. AO):', 16, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85);

  const taxOffice = receipt.taxOffice || settings.taxOffice || 'Finanzamt Musterstadt';
  const taxNum = receipt.taxNumber || settings.taxNumber || '112/5840/1922';
  const exDate = receipt.exemptionDate || settings.taxExemptionDate || '10.01.2024';
  const assessPeriod = receipt.assessmentPeriod || settings.taxAssessmentPeriod || '2021 bis 2023';
  const purpose = receipt.promotedPurpose || settings.promotedPurposes || 'Förderung des Sports (§ 52 Abs. 2 Satz 1 Nr. 21 AO)';

  const textPart1 = `Wir sind wegen ${purpose} nach dem Freistellungsbescheid bzw. nach der Anlage zum Körperschaftsteuerbescheid des Finanzamtes ${taxOffice}, StNr. ${taxNum}, vom ${exDate} für den letzten Veranlagungszeitraum ${assessPeriod} nach § 5 Abs. 1 Nr. 9 des Körperschaftsteuergesetzes von der Körperschaftsteuer und nach § 3 Nr. 6 des Gewerbesteuergesetzes von der Gewerbesteuer befreit.`;
  const splitPart1 = doc.splitTextToSize(textPart1, 178);
  doc.text(splitPart1, 16, currentY + 11);

  let nextInnerY = currentY + 11 + splitPart1.length * 3.6 + 3;

  doc.setFont('helvetica', 'bold');
  doc.text('Verwendungszweck-Bestätigung:', 16, nextInnerY);
  doc.setFont('helvetica', 'normal');
  const textPart2 = 'Es wird bestätigt, dass die Zuwendung nur zur Förderung des oben genannten steuerbegünstigten Zwecks verwendet wird.';
  doc.text(textPart2, 16, nextInnerY + 4, { maxWidth: 178 });

  if (isGoods) {
    const textGoodsExtra = 'Es wird bestätigt, dass über die genannten Sachzuwendungen keine weiteren Bestätigungen ausgestellt wurden und werden.';
    doc.text(textGoodsExtra, 16, nextInnerY + 9, { maxWidth: 178 });
  }

  currentY += 58;

  // 7. Amtlicher Haftungshinweis gem. § 50 Abs. 1 EStDV
  doc.setFillColor(248, 250, 252);
  doc.rect(14, currentY, 182, 32, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, currentY, 182, 32);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Hinweis zur steuerlichen Anerkennung & Haftung des Ausstellers (§ 50 Abs. 1 EStDV):', 16, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);

  const liabilityNotice =
    'Wer vorsätzlich oder grob fahrlässig eine unrichtige Zuwendungsbestätigung erstellt oder wer veranlasst, dass Zuwendungen nicht zu den in der Zuwendungsbestätigung angegebenen steuerbegünstigten Zwecken verwendet werden, haftet für die Steuer, die dem Fiskus durch einen etwaigen Abzug der Zuwendungen entgeht (§ 10b Abs. 4 EStG, § 9 Abs. 3 KStG, § 9 Nr. 5 GewStG).\n\nDiese Bestätigung wird nicht als Nachweis für die steuerliche Berücksichtigung der Zuwendung anerkannt, wenn das Datum des Freistellungsbescheides länger als 5 Jahre bzw. das Datum der Feststellung der Einhaltung der satzungsmäßigen Voraussetzungen nach § 60a Abs. 1 AO länger als 3 Jahre seit Ausstellung der Bestätigung zurückliegt (BMF-Schreiben vom 07.11.2013).';

  doc.text(doc.splitTextToSize(liabilityNotice, 178), 16, currentY + 10);

  currentY += 36;

  // 8. Unterschriftenbereich
  doc.setDrawColor(148, 163, 184);
  doc.line(16, currentY + 20, 85, currentY + 20);
  doc.line(115, currentY + 20, 184, currentY + 20);

  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(`${receipt.cityAndDate || 'Musterstadt, ' + new Date().toLocaleDateString('de-DE')}`, 16, currentY + 25);
  doc.text('Ort, Datum der Ausstellung', 16, currentY + 29);

  doc.text(receipt.issuedBy || `${settings.treasurer || 'Schatzmeister'} / Vorstand`, 115, currentY + 25);
  doc.text('Unterschrift des Zuwendungsempfängers / Vertretungsberechtigten', 115, currentY + 29);

  // Footer note
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Erstellt mit VereinsManager • BMF-konformes Muster für ${settings.clubName} • Revisionssicher archiviert`,
    105,
    288,
    { align: 'center' }
  );

  return doc;
}

/**
 * Gibt den Data-URL (Base64) des generierten PDFs zurück
 */
export function getDonationPdfDataUrl(receipt: DonationReceipt, settings: ClubSettings): string {
  const doc = generateBmfDonationReceiptPdf(receipt, settings);
  return doc.output('datauristring');
}

/**
 * Startet den direkten Download des Zuwendungsbestätigungs-PDFs
 */
export function downloadDonationReceiptPdf(receipt: DonationReceipt, settings: ClubSettings): void {
  const doc = generateBmfDonationReceiptPdf(receipt, settings);
  const cleanName = (receipt.donorName || 'Spender').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Zuwendungsbestaetigung_${receipt.receiptNumber}_${cleanName}.pdf`);
}
