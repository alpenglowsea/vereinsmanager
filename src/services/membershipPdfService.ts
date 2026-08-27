import jsPDF from 'jspdf';
import { OnlineMembershipApplication, ClubSettings } from '../types';

export function getMembershipTypeLabel(type: string): string {
  switch (type) {
    case 'full':
      return 'Vollmitglied / Erwachsener (Aktiv)';
    case 'reduced':
      return 'Ermäßigt (Schüler/Student/Azubi/Rentner)';
    case 'youth':
      return 'Kinder- & Jugendmitgliedschaft';
    case 'family':
      return 'Familienbeitrag';
    case 'supporting':
      return 'Passives Mitglied / Fördermitglied';
    case 'honorary':
      return 'Ehrenmitglied';
    default:
      return type || 'Standard';
  }
}

export function getGenderLabel(gender: string): string {
  switch (gender) {
    case 'm':
      return 'Männlich';
    case 'w':
      return 'Weiblich';
    case 'd':
      return 'Divers';
    default:
      return 'Keine Angabe';
  }
}

export function getPaymentMethodLabel(method: string): string {
  switch (method) {
    case 'sepa':
      return 'SEPA-Basislastschrift (Einzugsermächtigung)';
    case 'transfer':
      return 'Überweisung / Selbstzahler';
    case 'standing_order':
      return 'Dauerauftrag';
    case 'cash':
      return 'Barzahlung';
    default:
      return method;
  }
}

export function getFeePeriodLabel(period: string): string {
  switch (period) {
    case 'monthly':
      return 'Monatlich';
    case 'quarterly':
      return 'Vierteljährlich (Quartal)';
    case 'half_yearly':
      return 'Halbjährlich';
    case 'yearly':
      return 'Jährlich';
    default:
      return period;
  }
}

export function calculateAge(birthDateStr?: string): number | null {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Generiert ein hochoffizielles, rechtskonformes Aufnahmeantrags- & SEPA-Mandats-PDF
 */
export function generateMembershipApplicationPdf(
  app: OnlineMembershipApplication,
  settings: ClubSettings
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm
  let y = 14;

  // 1. Vereins-Kopfzeile
  doc.setFillColor(30, 58, 138); // Deep Navy Blue
  doc.rect(margin, y, contentWidth, 20, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.clubName, margin + 5, y + 8);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const subline = `${settings.address || 'Vereinsanschrift'} • Register: ${settings.associationNumber || 'Amtsgericht'} • St.-Nr.: ${settings.taxNumber || 'Finanzamt'}`;
  doc.text(subline, margin + 5, y + 15);

  y += 24;

  // 2. Dokumenten-Titel & Metadaten
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('AUFNAHMEANTRAG & BEITRITTSERKLÄRUNG', margin, y);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const submissionDateFormatted = app.submittedAt
    ? new Date(app.submittedAt).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleDateString('de-DE');
  doc.text(`Antrags-Nr.: ${app.applicationNumber} | Eingegangen am: ${submissionDateFormatted} Uhr`, margin, y + 5);

  y += 10;

  // Helper zum Zeichnen von Boxen mit Titeln
  const drawSectionHeader = (title: string, currentY: number): number => {
    doc.setFillColor(241, 245, 249); // Slate-100
    doc.setDrawColor(203, 213, 225); // Slate-300
    doc.setLineWidth(0.3);
    doc.rect(margin, currentY, contentWidth, 6, 'FD');

    doc.setTextColor(30, 41, 59); // Slate-800
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 3, currentY + 4.2);
    return currentY + 8;
  };

  // 3. Persönliche Angaben
  y = drawSectionHeader('1. Angaben zur Person (Antragsteller/in)', y);

  const age = calculateAge(app.birthDate);
  const birthFormatted = app.birthDate
    ? new Date(app.birthDate).toLocaleDateString('de-DE')
    : '–';

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  // Spalte 1 & 2
  const col1 = margin + 3;
  const col2 = margin + 95;

  doc.setFont('helvetica', 'bold');
  doc.text('Name, Vorname:', col1, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(`${app.lastName}, ${app.firstName}`, col1 + 30, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.text('Geburtsdatum:', col2, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(`${birthFormatted} ${age !== null ? `(${age} Jahre)` : ''}`, col2 + 25, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.text('Geschlecht:', col1, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.text(getGenderLabel(app.gender), col1 + 30, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.text('Nationalität:', col2, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.text(app.nationality || 'Deutsch', col2 + 25, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.text('Straße, Hausnr.:', col1, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(`${app.address.street} ${app.address.houseNumber}`, col1 + 30, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.text('PLZ, Wohnort:', col2, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(`${app.address.zip} ${app.address.city}`, col2 + 25, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.text('Telefon / Mobil:', col1, y + 19);
  doc.setFont('helvetica', 'normal');
  doc.text(app.phone || '–', col1 + 30, y + 19);

  doc.setFont('helvetica', 'bold');
  doc.text('E-Mail-Adresse:', col2, y + 19);
  doc.setFont('helvetica', 'normal');
  doc.text(app.email || '–', col2 + 25, y + 19);

  y += 24;

  // 4. Gesetzlicher Vertreter (falls minderjährig)
  if (app.isMinor || (age !== null && age < 18)) {
    y = drawSectionHeader('2. Gesetzliche/r Vertreter (bei Minderjährigen unter 18 Jahren)', y);

    doc.setFont('helvetica', 'bold');
    doc.text('Name d. Vertreters:', col1, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(app.guardianName || '–', col1 + 32, y + 4);

    doc.setFont('helvetica', 'bold');
    doc.text('Verwandtschaft:', col2, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(app.guardianRelation || 'Erziehungsberechtigte/r', col2 + 28, y + 4);

    doc.setFont('helvetica', 'bold');
    doc.text('Telefon Vertreter:', col1, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.text(app.guardianPhone || app.phone || '–', col1 + 32, y + 9);

    doc.setFont('helvetica', 'bold');
    doc.text('E-Mail Vertreter:', col2, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.text(app.guardianEmail || app.email || '–', col2 + 28, y + 9);

    y += 14;
  }

  // 5. Mitgliedschaft & Sparte
  y = drawSectionHeader('3. Gewünschte Mitgliedschaft & Sparte', y);

  const entryFormatted = app.entryDate
    ? new Date(app.entryDate).toLocaleDateString('de-DE')
    : new Date().toLocaleDateString('de-DE');

  doc.setFont('helvetica', 'bold');
  doc.text('Abteilung/Sparte:', col1, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(app.department || 'Hauptverein', col1 + 30, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.text('Gewünschter Eintritt:', col2, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(entryFormatted, col2 + 35, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.text('Mitgliedsart:', col1, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.text(getMembershipTypeLabel(app.membershipType), col1 + 30, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.text('Mitgliedsbeitrag:', col2, y + 9);
  doc.setFont('helvetica', 'normal');
  const feeDisplay = app.feeAmount !== undefined && app.feeAmount > 0
    ? `${app.feeAmount.toFixed(2).replace('.', ',')} € (${getFeePeriodLabel(app.feePeriod)})`
    : `Lt. Beitragsordnung (${getFeePeriodLabel(app.feePeriod)})`;
  doc.text(feeDisplay, col2 + 35, y + 9);

  if (app.previousClub || app.notes) {
    doc.setFont('helvetica', 'bold');
    doc.text('Vorverein/Notiz:', col1, y + 14);
    doc.setFont('helvetica', 'normal');
    const noteText = [app.previousClub ? `Bisher: ${app.previousClub}` : '', app.notes || ''].filter(Boolean).join(' | ');
    doc.text(noteText.slice(0, 75), col1 + 30, y + 14);
    y += 18;
  } else {
    y += 13;
  }

  // 6. Zahlungsweise & SEPA-Lastschriftmandat
  y = drawSectionHeader('4. Zahlungsweise & SEPA-Lastschriftmandat', y);

  doc.setFont('helvetica', 'bold');
  doc.text('Zahlungsweg:', col1, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(getPaymentMethodLabel(app.paymentMethod), col1 + 30, y + 4);

  if (app.paymentMethod === 'sepa' || app.bankDetails?.iban) {
    doc.setFont('helvetica', 'bold');
    doc.text('Gläubiger-ID:', col2, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(settings.creditorId || 'DE98ZZZ09999999999', col2 + 25, y + 4);

    doc.setFont('helvetica', 'bold');
    doc.text('Kontoinhaber:', col1, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.text(app.bankDetails?.accountHolder || `${app.firstName} ${app.lastName}`, col1 + 30, y + 9);

    doc.setFont('helvetica', 'bold');
    doc.text('IBAN:', col2, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.text(app.bankDetails?.iban || '–', col2 + 25, y + 9);

    doc.setFont('helvetica', 'bold');
    doc.text('Kreditinstitut:', col1, y + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(app.bankDetails?.bankName || '–', col1 + 30, y + 14);

    doc.setFont('helvetica', 'bold');
    doc.text('BIC:', col2, y + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(app.bankDetails?.bic || '–', col2 + 25, y + 14);

    y += 19;

    // SEPA Hinweistext Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 14, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const sepaLegal = `SEPA-Mandatstext: Ich ermächtige ${settings.clubName}, Zahlungen von meinem Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die vom Verein auf mein Konto gezogenen Lastschriften einzulösen. Hinweis: Ich kann innerhalb von 8 Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem Kreditinstitut vereinbarten Bedingungen.`;
    const splitLegal = doc.splitTextToSize(sepaLegal, contentWidth - 6);
    doc.text(splitLegal, margin + 3, y + 3.5);

    y += 16;
  } else {
    y += 8;
  }

  // 7. Rechtliche Erklärungen & Einwilligungen
  y = drawSectionHeader('5. Rechtliche Erklärungen & Zustimmungen', y);

  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);

  const checkChar = '[X]';
  doc.setFont('helvetica', 'bold');
  doc.text(`${checkChar} Datenschutzhinweis (DSGVO):`, col1, y + 3.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Einwilligung zur Erhebung und Verarbeitung der personenbezogenen Daten für vereinsinterne Zwecke erteilt.', col1 + 45, y + 3.5);

  doc.setFont('helvetica', 'bold');
  doc.text(`${checkChar} Satzungsanerkennung:`, col1, y + 7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Die Vereinssatzung und Beitragsordnung von ${settings.clubName} werden vollinhaltlich anerkannt.`, col1 + 45, y + 7.5);

  if (app.photoConsent) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${checkChar} Foto- & Mediennutzung:`, col1, y + 11.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Einwilligung zur Veröffentlichung von Foto-/Videoaufnahmen von Sportveranstaltungen im Rahmen der Vereinsarbeit.', col1 + 45, y + 11.5);
  }

  if (app.healthConfirmation) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${checkChar} Sportgesundheit:`, col1, y + 15.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Bestätigung, dass keine gesundheitlichen Bedenken gegen eine aktive sportliche Betätigung im Verein bestehen.', col1 + 45, y + 15.5);
  }

  y += app.healthConfirmation ? 20 : 15;

  // 8. Unterschriften-Bereich
  y = drawSectionHeader('6. Rechtsverbindliche Unterschriften', y);

  const signBoxWidth = (contentWidth - 6) / 2; // ~88mm je Box
  const signBoxHeight = 24;

  // Box 1: Unterschrift Antragsteller
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, signBoxWidth, signBoxHeight, 'FD');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Unterschrift Antragsteller/in:', margin + 2, y + 4);

  if (app.applicantSignature && app.applicantSignature.startsWith('data:image')) {
    try {
      doc.addImage(app.applicantSignature, 'PNG', margin + 3, y + 5, signBoxWidth - 6, signBoxHeight - 9);
    } catch (e) {
      doc.text('[Digital signiert]', margin + 5, y + 14);
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  const signDate1 = app.applicantSignatureDate
    ? new Date(app.applicantSignatureDate).toLocaleDateString('de-DE')
    : new Date().toLocaleDateString('de-DE');
  doc.text(`Datum: ${signDate1} | Ort: ${app.address.city || 'Online'}`, margin + 2, y + signBoxHeight - 1.5);

  // Box 2: Gesetzlicher Vertreter ODER Kontoinhaber
  const rightBoxX = margin + signBoxWidth + 6;
  doc.rect(rightBoxX, y, signBoxWidth, signBoxHeight, 'FD');

  const isMinorSign = app.isMinor || (age !== null && age < 18);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(
    isMinorSign
      ? 'Unterschrift gesetzl. Vertreter:'
      : 'Unterschrift Kontoinhaber (SEPA):',
    rightBoxX + 2,
    y + 4
  );

  const secondSig = isMinorSign ? app.guardianSignature : app.sepaSignature;
  if (secondSig && secondSig.startsWith('data:image')) {
    try {
      doc.addImage(secondSig, 'PNG', rightBoxX + 3, y + 5, signBoxWidth - 6, signBoxHeight - 9);
    } catch (e) {
      doc.text('[Digital signiert]', rightBoxX + 5, y + 14);
    }
  } else if (app.applicantSignature && !isMinorSign) {
    // Wenn Volljährig & gleicher Kontoinhaber, gleiche Signatur nutzen
    try {
      doc.addImage(app.applicantSignature, 'PNG', rightBoxX + 3, y + 5, signBoxWidth - 6, signBoxHeight - 9);
    } catch (e) {}
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(`Datum: ${signDate1} | Status: Digital erfasst`, rightBoxX + 2, y + signBoxHeight - 1.5);

  // Fußzeile
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Erstellt mit VereinsManager Digitalaufnahme • ${settings.clubName} • Dokumenten-Prüfsumme: ${app.id.slice(0, 12)}`,
    margin,
    290
  );

  return doc;
}

/**
 * Erzeugt einen Base64 Data-URL-String des Aufnahmeantrag-PDFs
 */
export function getMembershipApplicationPdfDataUrl(
  app: OnlineMembershipApplication,
  settings: ClubSettings
): string {
  const doc = generateMembershipApplicationPdf(app, settings);
  return doc.output('datauristring');
}
