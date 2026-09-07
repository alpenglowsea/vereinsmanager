import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Meeting, ClubSettings, MeetingTemplateSettings, MeetingType } from '../types';
import { DEFAULT_MEETING_TEMPLATE } from '../data/initialMeetings';

function formatMeetingType(type: MeetingType): string {
  switch (type) {
    case 'board':
      return 'Vorstandssitzung';
    case 'general_assembly':
      return 'Ordentliche Mitgliederversammlung';
    case 'extraordinary_assembly':
      return 'Außerordentliche Mitgliederversammlung';
    case 'committee':
      return 'Ausschuss- & Fachbereichssitzung';
    case 'department':
      return 'Abteilungsversammlung';
    default:
      return 'Sitzung & Versammlung';
  }
}

function formatDateGerman(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function formatDateTimeGerman(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' Uhr';
  } catch {
    return dateStr;
  }
}

export interface ProtocolPdfOptions {
  includeDigitalSignatures?: boolean;
}

export const MeetingPdfService = {
  /**
   * Erzeugt das vollständige rechtssichere Vereinsprotokoll
   * Unterstützt benutzerdefiniertes Vereins-Briefpapier als Hintergrund
   * Ermöglicht wahlweise Export mit digitaler Signatur oder als Blanko-Signaturzeile
   */
  async generateProtocolPdf(
    meeting: Meeting,
    settings: ClubSettings,
    template: MeetingTemplateSettings = DEFAULT_MEETING_TEMPLATE,
    options?: ProtocolPdfOptions
  ): Promise<jsPDF> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const marginLeft = template.marginLeft || 20;
    const marginRight = template.marginRight || 20;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const marginTop = template.marginTop || 35;
    const marginBottom = template.marginBottom || 25;

    const hasCustomBlanko = Boolean(template.customBlankoDataUrl && template.customBlankoDataUrl.trim().length > 0);

    const renderPageBackground = () => {
      if (hasCustomBlanko && template.customBlankoDataUrl) {
        try {
          doc.addImage(template.customBlankoDataUrl, 'PNG', 0, 0, pageWidth, pageHeight);
        } catch {
          try {
            doc.addImage(template.customBlankoDataUrl, 'JPEG', 0, 0, pageWidth, pageHeight);
          } catch (err) {
            console.error('Failed to render blanko letterhead:', err);
          }
        }
      } else if (template.showClubHeader) {
        // Standard Vereins-Briefkopf
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(30, 41, 59); // Slate-800
        doc.text(settings.clubName, marginLeft, 18);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139); // Slate-500
        doc.text(
          `${settings.associationNumber || ''} • ${settings.taxOffice || 'Finanzamt'} • St.-Nr.: ${settings.taxNumber || ''}`,
          marginLeft,
          23
        );

        doc.setDrawColor(203, 213, 225); // Slate-300
        doc.setLineWidth(0.4);
        doc.line(marginLeft, 26, pageWidth - marginRight, 26);
      }
    };

    // Seite 1 Hintergrund
    renderPageBackground();

    let currentY = marginTop;

    const checkPageBreak = (spaceNeeded: number) => {
      if (currentY + spaceNeeded > pageHeight - marginBottom) {
        doc.addPage();
        renderPageBackground();
        currentY = marginTop;
      }
    };

    // 1. Titel & Dokumentenkopf
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42); // Slate-900

    const isGeneralAssembly = meeting.type === 'general_assembly' || meeting.type === 'extraordinary_assembly';
    const mainTitle = isGeneralAssembly ? 'NIEDERSCHRIFT / PROTOKOLL' : 'SITZUNGSPROTOKOLL';
    doc.text(mainTitle, marginLeft, currentY);
    currentY += 6.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(79, 70, 229); // Indigo-600
    const meetingTitleLines = doc.splitTextToSize(meeting.title, contentWidth);
    doc.text(meetingTitleLines, marginLeft, currentY);
    currentY += meetingTitleLines.length * 5.2 + 2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const subline = `Sitzungsart: ${formatMeetingType(meeting.type)}   •   Protokollform: ${meeting.protocolType === 'verbatim' ? 'Ausführliches Verlaufsprotokoll' : 'Ergebnisprotokoll'}`;
    const sublineLines = doc.splitTextToSize(subline, contentWidth);
    doc.text(sublineLines, marginLeft, currentY);
    currentY += sublineLines.length * 4.2 + 4.5;

    // 2. Formalia-Kasten (Ort, Zeit, Leitung, Beschlussfähigkeit)
    // Saubere, streng begrenzte 2-Spalten-Struktur mit garantierter Rand-Einhaltung & bündiger Textausrichtung
    const col1Width = 78;
    const col2Width = contentWidth - col1Width - 6; // ~86mm
    const col1X = marginLeft + 4;
    const col2X = marginLeft + col1Width + 6;
    const col1LabelW = 24;
    const col1ValW = col1Width - col1LabelW - 3; // ~51mm
    const col2LabelW = 28; // Ausreichend Platz für 'Stimmberechtigte:' (~22mm), garantiert bündige Ausrichtung aller Zeilen
    const col2ValW = col2Width - col2LabelW - 4; // ~54mm

    // Formatiere und splitte alle Werte vorher für exakte Randkontrolle
    const dateTimeStr = `${formatDateGerman(meeting.date)}, ${meeting.startTime} Uhr${meeting.endTime ? ' – ' + meeting.endTime + ' Uhr' : ''}`;
    const dateTimeLines = doc.splitTextToSize(dateTimeStr, col1ValW).slice(0, 2);

    const chairStr = meeting.chairperson || '–';
    const chairLines = doc.splitTextToSize(chairStr, col2ValW).slice(0, 2);

    const locStr = meeting.location || 'Vereinsheim';
    const locLines = doc.splitTextToSize(locStr, col1ValW).slice(0, 2);

    const minuteKeeperStr = meeting.minuteKeeper || '–';
    const minuteKeeperLines = doc.splitTextToSize(minuteKeeperStr, col2ValW).slice(0, 2);

    const invStr = meeting.invitationCompliant ? 'Form- & fristgerecht gem. Satzung' : 'Prüfung erforderlich';
    const invLines = doc.splitTextToSize(invStr, col1ValW).slice(0, 2);

    const votersCount = meeting.totalEligibleVoters || meeting.attendees.filter(a => a.present && a.hasVotingRight).length || '–';
    const votersStr = `${votersCount} stimmberechtigt anwesend`;
    const votersLines = doc.splitTextToSize(votersStr, col2ValW).slice(0, 2);

    const quorumStr = meeting.quorumConfirmed ? 'Gegeben und ordnungsgemäß festgestellt' : 'Nicht bestätigt';
    const quorumLines = doc.splitTextToSize(quorumStr, col1ValW).slice(0, 2);

    const statusLabel = meeting.status === 'approved' ? 'Genehmigt & rechtsgültig' : meeting.status === 'review' ? 'In Vorprüfung' : 'Entwurf';
    const statusLines = doc.splitTextToSize(statusLabel, col2ValW).slice(0, 2);

    // Berechne Zeilenabstände dynamisch
    const rowGap = 7.6;
    const formaliaBoxHeight = Math.max(36, 5.5 + 3 * rowGap + 6.0);

    doc.setFillColor(248, 250, 252); // Slate-50
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.35);
    doc.roundedRect(marginLeft, currentY, contentWidth, formaliaBoxHeight, 2, 2, 'FD');

    let boxRowY = currentY + 5.5;

    // Zeile 1: Datum & Uhrzeit | Leitung
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('Datum & Zeit:', col1X, boxRowY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(dateTimeLines, col1X + col1LabelW, boxRowY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Leitung:', col2X, boxRowY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(chairLines, col2X + col2LabelW, boxRowY);

    // Zeile 2: Ort | Protokollführung
    boxRowY += rowGap;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Ort:', col1X, boxRowY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(locLines, col1X + col1LabelW, boxRowY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Protokoll:', col2X, boxRowY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(minuteKeeperLines, col2X + col2LabelW, boxRowY);

    // Zeile 3: Einberufung | Stimmberechtigte
    boxRowY += rowGap;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Einberufung:', col1X, boxRowY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(invLines, col1X + col1LabelW, boxRowY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Stimmberechtigte:', col2X, boxRowY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(votersLines, col2X + col2LabelW, boxRowY);

    // Zeile 4: Beschlussfähigkeit | Status
    boxRowY += rowGap;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Beschlussf.:', col1X, boxRowY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(quorumLines, col1X + col1LabelW, boxRowY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Status:', col2X, boxRowY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(statusLines, col2X + col2LabelW, boxRowY);

    currentY += formaliaBoxHeight + 7;

    // 3. Tagesordnung & Verlauf (TOPs)
    checkPageBreak(15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Tagesordnung & Beratungsverlauf', marginLeft, currentY);
    currentY += 6;

    meeting.agenda.forEach((top) => {
      checkPageBreak(25);

      // TOP Header: dynamische Breite & Berichterstatter-Kollisionsschutz
      const speakerText = top.speaker ? `Berichterstatter: ${top.speaker}` : '';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const speakerWidth = speakerText ? doc.getTextWidth(speakerText) + 4 : 0;
      const titleAvailableWidth = contentWidth - speakerWidth - 8;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const topTitleLines = doc.splitTextToSize(`${top.number}: ${top.title}`, Math.max(titleAvailableWidth, 60));
      const topBarHeight = Math.max(7.5, topTitleLines.length * 4.4 + 3);

      doc.setFillColor(241, 245, 249); // Slate-100
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(marginLeft, currentY, contentWidth, topBarHeight, 1, 1, 'FD');

      doc.text(topTitleLines, marginLeft + 3, currentY + 4.8);

      if (speakerText) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(speakerText, pageWidth - marginRight - 3, currentY + 4.8, { align: 'right' });
      }

      currentY += topBarHeight + 3.5;

      // Besprechung / Verlauf (zeilenweiser Seitenumbruch bei langen Texten)
      if (top.discussionNotes && top.discussionNotes.trim().length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        const splitNotes = doc.splitTextToSize(top.discussionNotes, contentWidth - 4);
        for (let i = 0; i < splitNotes.length; i++) {
          checkPageBreak(5.0);
          doc.text(splitNotes[i], marginLeft + 2, currentY);
          currentY += 4.3;
        }
        currentY += 3.0;
      }

      // Beschlüsse zu diesem TOP
      if (top.resolutions && top.resolutions.length > 0) {
        top.resolutions.forEach((res) => {
          const isAccepted = res.result === 'accepted';
          const statusText = isAccepted ? 'ANGENOMMEN' : res.result === 'rejected' ? 'ABGELEHNT' : 'VERTAGT';

          // Textblöcke aufbereiten
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          const badgeSpace = 28;
          const titleLines = doc.splitTextToSize(`BESCHLUSS [TOP ${res.agendaItemNumber}]: ${res.title}`, contentWidth - badgeSpace - 10);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          const motionLines = doc.splitTextToSize(`Antrag / Beschlusstext: "${res.motionText}"`, contentWidth - 10);

          const voteText = `Abstimmungsergebnis:  Ja: ${res.votesFor}   |   Nein: ${res.votesAgainst}   |   Enthaltungen: ${res.votesAbstain}${res.proposer ? `   |   Antragsteller: ${res.proposer}` : ''}`;
          const voteLines = doc.splitTextToSize(voteText, contentWidth - 10);

          const noticeItems: string[] = [];
          if (res.isTaxRelevant) noticeItems.push('Steuerlich relevant (Finanzamt / EÜR)');
          if (res.isRegisterRelevant) noticeItems.push('Vereinsregister relevant (§ 26 BGB / Satzungsänderung)');
          if (res.responsiblePerson) {
            noticeItems.push(`Verantwortlich: ${res.responsiblePerson}${res.dueDate ? ` (Frist: ${res.dueDate})` : ''}`);
          }
          const noticeLines = noticeItems.length > 0
            ? doc.splitTextToSize(`Hinweis: ${noticeItems.join('  •  ')}`, contentWidth - 10)
            : [];

          // Mathematisch exakte Höhenberechnung für perfekten Abstand
          const titleBlockH = titleLines.length * 4.2;
          const motionBlockH = motionLines.length * 3.9;
          const voteBlockH = voteLines.length * 3.9;
          const noticeBlockH = noticeLines.length > 0 ? noticeLines.length * 3.6 + 1.5 : 0;

          const boxPaddingTop = 4.0;
          const gapBetween = 2.8;
          const boxPaddingBottom = 4.0;

          const totalBoxHeight =
            boxPaddingTop +
            titleBlockH +
            gapBetween +
            motionBlockH +
            gapBetween +
            voteBlockH +
            (noticeBlockH > 0 ? gapBetween + noticeBlockH : 0) +
            boxPaddingBottom;

          checkPageBreak(totalBoxHeight + 5);

          // Beschluss-Kasten zeichnen
          doc.setFillColor(isAccepted ? 240 : 254, isAccepted ? 253 : 242, isAccepted ? 244 : 242);
          doc.setDrawColor(isAccepted ? 134 : 252, isAccepted ? 239 : 165, isAccepted ? 172 : 165);
          doc.setLineWidth(0.4);
          doc.roundedRect(marginLeft, currentY, contentWidth, totalBoxHeight, 1.5, 1.5, 'FD');

          let innerY = currentY + boxPaddingTop;

          // 1. Titel & Status-Badge
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(isAccepted ? 22 : 153, isAccepted ? 101 : 27, isAccepted ? 52 : 27);
          doc.text(titleLines, marginLeft + 4, innerY + 2.5);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(`[${statusText}]`, pageWidth - marginRight - 4, innerY + 2.5, { align: 'right' });

          innerY += titleBlockH + gapBetween;

          // 2. Beschlusstext
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          doc.text(motionLines, marginLeft + 4, innerY + 2.2);

          innerY += motionBlockH + gapBetween;

          // 3. Abstimmungsergebnis
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          doc.text(voteLines, marginLeft + 4, innerY + 2.2);

          innerY += voteBlockH;

          // 4. Relevanz-Hinweise
          if (noticeLines.length > 0) {
            innerY += gapBetween;
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7.5);
            doc.setTextColor(180, 83, 9); // Amber-700
            doc.text(noticeLines, marginLeft + 4, innerY + 2.0);
          }

          currentY += totalBoxHeight + 4.5;
        });
      }

      currentY += 3.5;
    });

    // 4. Anwesenheit / Teilnehmer
    if (meeting.attendees && meeting.attendees.length > 0) {
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Teilnehmer & Anwesenheitsliste', marginLeft, currentY);
      currentY += 5;

      const attendeeRows = meeting.attendees.map(a => [
        a.name,
        a.role || 'Mitglied',
        a.present ? 'Anwesend' : 'Entschuldigt',
        a.hasVotingRight ? 'Ja' : 'Nein',
        a.isSignatory ? 'Ja (Protokollunterschrift)' : '–'
      ]);

      autoTable(doc, {
        startY: currentY,
        margin: { left: marginLeft, right: marginRight },
        head: [['Name', 'Funktion', 'Status', 'Stimmrecht', 'Satzungsunterzeichner']],
        body: attendeeRows,
        theme: 'plain',
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [51, 65, 85],
          fontSize: 8,
          fontStyle: 'bold',
          cellPadding: 2.2
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [71, 85, 105],
          cellPadding: 2.0
        }
      });

      // @ts-expect-error - jspdf-autotable modifies doc.lastAutoTable
      currentY = (doc.lastAutoTable?.finalY || currentY) + 7;
    }

    // 5. Allgemeine Anmerkungen
    if (meeting.generalNotes && meeting.generalNotes.trim().length > 0) {
      checkPageBreak(22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text('Besondere Bemerkungen & Versammlungsabschluss:', marginLeft, currentY);
      currentY += 5.0;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const splitGeneral = doc.splitTextToSize(meeting.generalNotes, contentWidth);
      for (let i = 0; i < splitGeneral.length; i++) {
        checkPageBreak(5.0);
        doc.text(splitGeneral[i], marginLeft, currentY);
        currentY += 4.2;
      }
      currentY += 4.0;
    }

    // 6. Unterschriftenblock
    if (template.showSignaturesBlock) {
      checkPageBreak(40);
      currentY += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      const addressText = typeof settings.address === 'string' ? settings.address : (settings.address?.city || 'Musterstadt');
      const cityPart = typeof settings.address === 'string' && settings.address.includes(',') ? settings.address.split(',')[1].trim() : addressText;
      const signPlace = `${cityPart || 'Musterstadt'}, den ${formatDateGerman(meeting.signedAt || meeting.date)}`;
      doc.text(signPlace, marginLeft, currentY);

      // 2 Unterschriftslinien
      const halfWidth = contentWidth / 2 - 10;
      const sig1X = marginLeft;
      const sig2X = marginLeft + contentWidth / 2 + 10;

      // Digital signatures lookup
      const shouldIncludeSignatures = options?.includeDigitalSignatures !== false;
      const chairpersonSig = meeting.signatures?.find(s =>
        s.role.toLowerCase().includes('leiter') ||
        s.role.toLowerCase().includes('vorsitz') ||
        (meeting.chairperson && s.name.toLowerCase() === meeting.chairperson.toLowerCase())
      ) || (meeting.signatures && meeting.signatures[0]);

      const minuteKeeperSig = meeting.signatures?.find(s =>
        s !== chairpersonSig && (
          s.role.toLowerCase().includes('schrift') ||
          s.role.toLowerCase().includes('protokoll') ||
          (meeting.minuteKeeper && s.name.toLowerCase() === meeting.minuteKeeper.toLowerCase())
        )
      ) || (meeting.signatures && meeting.signatures.length > 1 ? meeting.signatures[1] : undefined);

      currentY += 15; // 15mm Freiraum für die handschriftliche Unterschrift

      // Digitale Unterschriften einbinden (falls vorhanden und aktiviert)
      if (shouldIncludeSignatures && chairpersonSig?.signatureDataUrl) {
        try {
          doc.addImage(chairpersonSig.signatureDataUrl, 'PNG', sig1X + 2, currentY - 14, 42, 13);
        } catch (err) {
          console.warn('Failed to render chairperson signature image:', err);
        }
      }

      if (shouldIncludeSignatures && minuteKeeperSig?.signatureDataUrl) {
        try {
          doc.addImage(minuteKeeperSig.signatureDataUrl, 'PNG', sig2X + 2, currentY - 14, 42, 13);
        } catch (err) {
          console.warn('Failed to render minuteKeeper signature image:', err);
        }
      }

      // Linie 1: Versammlungsleitung
      doc.setDrawColor(148, 163, 184); // Slate-400
      doc.setLineWidth(0.4);
      doc.line(sig1X, currentY, sig1X + halfWidth, currentY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(meeting.chairperson || 'Versammlungsleiter', sig1X, currentY + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Versammlungsleiter gem. Satzung', sig1X, currentY + 8.5);

      // Linie 2: Protokollführung
      doc.line(sig2X, currentY, sig2X + halfWidth, currentY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(meeting.minuteKeeper || 'Protokollführer / Schriftführer', sig2X, currentY + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Protokollführer gem. Satzung', sig2X, currentY + 8.5);

      if (shouldIncludeSignatures) {
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        if (chairpersonSig?.signedAt) {
          doc.text(`Digital signiert: ${formatDateTimeGerman(chairpersonSig.signedAt)}`, sig1X, currentY + 12);
        }
        if (minuteKeeperSig?.signedAt) {
          doc.text(`Digital signiert: ${formatDateTimeGerman(minuteKeeperSig.signedAt)}`, sig2X, currentY + 12);
        }
      }
    }

    // 7. Seitenzahlen unten
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Protokoll: ${meeting.title} • Seite ${i} von ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    return doc;
  },

  /**
   * Erzeugt einen rechtssicheren Auszug des Protokolls zur Vorlage bei Vereinsregister / Notariat
   */
  async generateRegisterExtractPdf(
    meeting: Meeting,
    settings: ClubSettings,
    template: MeetingTemplateSettings = DEFAULT_MEETING_TEMPLATE,
    options?: ProtocolPdfOptions
  ): Promise<jsPDF> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const marginLeft = template.marginLeft || 20;
    const marginRight = template.marginRight || 20;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const marginTop = template.marginTop || 35;
    const marginBottom = template.marginBottom || 25;

    const hasCustomBlanko = Boolean(template.customBlankoDataUrl && template.customBlankoDataUrl.trim().length > 0);

    const renderPageBackground = () => {
      if (hasCustomBlanko && template.customBlankoDataUrl) {
        try {
          doc.addImage(template.customBlankoDataUrl, 'PNG', 0, 0, pageWidth, pageHeight);
        } catch {
          try {
            doc.addImage(template.customBlankoDataUrl, 'JPEG', 0, 0, pageWidth, pageHeight);
          } catch (err) {
            console.error('Failed to render blanko letterhead:', err);
          }
        }
      } else if (template.showClubHeader) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(30, 41, 59);
        doc.text(settings.clubName, marginLeft, 18);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `Eingetragen im Vereinsregister: ${settings.associationNumber || 'Amtsgericht'}`,
          marginLeft,
          23
        );

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.line(marginLeft, 26, pageWidth - marginRight, 26);
      }
    };

    renderPageBackground();

    let currentY = marginTop;

    const checkPageBreak = (spaceNeeded: number) => {
      if (currentY + spaceNeeded > pageHeight - marginBottom) {
        doc.addPage();
        renderPageBackground();
        currentY = marginTop;
      }
    };

    // Titel Register-Auszug
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('AUSZUG AUS DEM SITZUNGSPROTOKOLL', marginLeft, currentY);
    currentY += 6.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229);
    const subTitleLines = doc.splitTextToSize(`Zur Vorlage beim Vereinsregister / Notariat  •  ${meeting.title}`, contentWidth);
    doc.text(subTitleLines, marginLeft, currentY);
    currentY += subTitleLines.length * 4.6 + 4.5;

    // Einleitung & Feststellung der Formalia
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    const eligibleCount = meeting.totalEligibleVoters || meeting.attendees.filter(a => a.present && a.hasVotingRight).length || 'alle erforderlichen';

    const introParagraphs = [
      `Hiermit wird bescheinigt, dass am ${formatDateGerman(meeting.date)} in ${meeting.location || 'Vereinsheim'} die ${formatMeetingType(meeting.type)} stattgefunden hat.`,
      `1. Einberufung: Die Versammlung wurde ${meeting.invitationCompliant ? 'ordnungsgemäß, form- und fristgerecht' : 'gem. Satzung'}${meeting.invitationMethod ? ' (' + meeting.invitationMethod + ')' : ''} einberufen.`,
      `2. Beschlussfähigkeit: Die Versammlung war beschlussfähig. Es waren ${eligibleCount} stimmberechtigte Mitglieder anwesend.`,
      `3. Versammlungsleitung: Versammlungsleiter war ${meeting.chairperson || '–'}, Schriftführer war ${meeting.minuteKeeper || '–'}.`,
      'In dieser Versammlung wurden u. a. folgende registerrelevante Beschlüsse gefasst:'
    ];

    introParagraphs.forEach((para, pIdx) => {
      const pLines = doc.splitTextToSize(para, contentWidth);
      checkPageBreak(pLines.length * 4.3 + 2.5);
      doc.text(pLines, marginLeft, currentY);
      currentY += pLines.length * 4.3 + (pIdx === 0 || pIdx === 3 ? 3.0 : 2.0);
    });

    currentY += 3.5;

    // Registerrelevante Beschlüsse filtern
    const registerResolutions = meeting.agenda
      .flatMap(top => top.resolutions || [])
      .filter(r => r.isRegisterRelevant || r.title.toLowerCase().includes('wahl') || r.title.toLowerCase().includes('satzung'));

    if (registerResolutions.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Im Protokoll wurden keine explizit als registerrelevant markierten Beschlüsse hinterlegt.', marginLeft, currentY);
      currentY += 10;
    } else {
      registerResolutions.forEach((res, idx) => {
        const isAccepted = res.result === 'accepted';
        const titleLines = doc.splitTextToSize(`Beschluss Nr. ${idx + 1} (TOP ${res.agendaItemNumber}): ${res.title}`, contentWidth - 8);
        const motionLines = doc.splitTextToSize(`Wortlaut des Antrags / Beschlusses:\n"${res.motionText}"`, contentWidth - 8);
        const resultStatus = isAccepted ? 'EINSTIMMIG / MEHRHEITLICH ANGENOMMEN' : 'ABGELEHNT';
        const resultText = `Ergebnis: ${resultStatus}  (Ja: ${res.votesFor}, Nein: ${res.votesAgainst}, Enthaltungen: ${res.votesAbstain})`;
        const resultLines = doc.splitTextToSize(resultText, contentWidth - 8);

        const titleBlockH = titleLines.length * 4.2;
        const motionBlockH = motionLines.length * 3.9;
        const resultBlockH = resultLines.length * 3.9;

        const boxPaddingTop = 4.0;
        const gapBetween = 2.8;
        const boxPaddingBottom = 4.0;

        const totalBoxH = boxPaddingTop + titleBlockH + gapBetween + motionBlockH + gapBetween + resultBlockH + boxPaddingBottom;

        checkPageBreak(totalBoxH + 4);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.35);
        doc.roundedRect(marginLeft, currentY, contentWidth, totalBoxH, 1.5, 1.5, 'FD');

        let innerY = currentY + boxPaddingTop;

        // Beschlusstitel
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(titleLines, marginLeft + 4, innerY + 2.5);
        innerY += titleBlockH + gapBetween;

        // Antragswortlaut
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(motionLines, marginLeft + 4, innerY + 2.2);
        innerY += motionBlockH + gapBetween;

        // Abstimmungsergebnis
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(isAccepted ? 22 : 153, isAccepted ? 101 : 27, isAccepted ? 52 : 27);
        doc.text(resultLines, marginLeft + 4, innerY + 2.2);

        currentY += totalBoxH + 4.5;
      });
    }

    // Bestätigungsvermerk & Unterschriften
    checkPageBreak(38);
    currentY += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const confText = 'Die Richtigkeit und Vollständigkeit dieses Auszugs aus der Urschrift des Protokolls wird hiermit bestätigt:';
    doc.text(confText, marginLeft, currentY);
    currentY += 5.5;

    const addressText = typeof settings.address === 'string' ? settings.address : (settings.address?.city || 'Musterstadt');
    const cityPart = typeof settings.address === 'string' && settings.address.includes(',') ? settings.address.split(',')[1].trim() : addressText;
    const signPlace = `${cityPart || 'Musterstadt'}, den ${formatDateGerman(meeting.signedAt || meeting.date)}`;
    doc.text(signPlace, marginLeft, currentY);

    const halfWidth = contentWidth / 2 - 10;
    const sig1X = marginLeft;
    const sig2X = marginLeft + contentWidth / 2 + 10;

    // Digital signatures lookup
    const shouldIncludeSignatures = options?.includeDigitalSignatures !== false;
    const chairpersonSig = meeting.signatures?.find(s =>
      s.role.toLowerCase().includes('leiter') ||
      s.role.toLowerCase().includes('vorsitz') ||
      (meeting.chairperson && s.name.toLowerCase() === meeting.chairperson.toLowerCase())
    ) || (meeting.signatures && meeting.signatures[0]);

    const minuteKeeperSig = meeting.signatures?.find(s =>
      s !== chairpersonSig && (
        s.role.toLowerCase().includes('schrift') ||
        s.role.toLowerCase().includes('protokoll') ||
        (meeting.minuteKeeper && s.name.toLowerCase() === meeting.minuteKeeper.toLowerCase())
      )
    ) || (meeting.signatures && meeting.signatures.length > 1 ? meeting.signatures[1] : undefined);

    currentY += 15; // 15mm für handschriftliche Unterschriften

    // Digitale Unterschriften einbinden (falls vorhanden und aktiviert)
    if (shouldIncludeSignatures && chairpersonSig?.signatureDataUrl) {
      try {
        doc.addImage(chairpersonSig.signatureDataUrl, 'PNG', sig1X + 2, currentY - 14, 42, 13);
      } catch (err) {
        console.warn('Failed to render chairperson signature on register extract:', err);
      }
    }

    if (shouldIncludeSignatures && minuteKeeperSig?.signatureDataUrl) {
      try {
        doc.addImage(minuteKeeperSig.signatureDataUrl, 'PNG', sig2X + 2, currentY - 14, 42, 13);
      } catch (err) {
        console.warn('Failed to render minuteKeeper signature on register extract:', err);
      }
    }

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.4);
    doc.line(sig1X, currentY, sig1X + halfWidth, currentY);
    doc.line(sig2X, currentY, sig2X + halfWidth, currentY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(meeting.chairperson || 'Versammlungsleiter', sig1X, currentY + 4.5);
    doc.text(meeting.minuteKeeper || 'Protokollführer / Schriftführer', sig2X, currentY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Versammlungsleiter gem. Satzung', sig1X, currentY + 8.5);
    doc.text('Schriftführer / Protokollführer gem. Satzung', sig2X, currentY + 8.5);

    if (shouldIncludeSignatures) {
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      if (chairpersonSig?.signedAt) {
        doc.text(`Digital signiert: ${formatDateTimeGerman(chairpersonSig.signedAt)}`, sig1X, currentY + 12);
      }
      if (minuteKeeperSig?.signedAt) {
        doc.text(`Digital signiert: ${formatDateTimeGerman(minuteKeeperSig.signedAt)}`, sig2X, currentY + 12);
      }
    }

    // Seitenzahlen unten
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Registerauszug: ${meeting.title} • Seite ${i} von ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    return doc;
  },

  /**
   * Erzeugt ein form- und fristgerechtes offizielles Einladungsschreiben (PDF)
   * inklusive vorläufiger Tagesordnung gem. § 32 Abs. 1 Satz 2 BGB und Vereinssatzung.
   * Unterstützt benutzerdefiniertes Vereins-Briefpapier als Hintergrund.
   */
  async generateInvitationPdf(
    meeting: {
      title: string;
      type: MeetingType;
      date: string;
      startTime: string;
      endTime?: string;
      location?: string;
      chairperson?: string;
      minuteKeeper?: string;
      invitationDate?: string;
      agenda: any[];
    },
    settings: ClubSettings,
    template: MeetingTemplateSettings = DEFAULT_MEETING_TEMPLATE,
    options?: {
      motionDeadlineDays?: number;
      customNotice?: string;
    }
  ): Promise<jsPDF> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const marginLeft = template.marginLeft || 20;
    const marginRight = template.marginRight || 20;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const marginTop = template.marginTop || 35;
    const marginBottom = template.marginBottom || 25;

    const hasCustomBlanko = Boolean(template.customBlankoDataUrl && template.customBlankoDataUrl.trim().length > 0);

    const renderPageBackground = () => {
      if (hasCustomBlanko && template.customBlankoDataUrl) {
        try {
          doc.addImage(template.customBlankoDataUrl, 'PNG', 0, 0, pageWidth, pageHeight);
        } catch {
          try {
            doc.addImage(template.customBlankoDataUrl, 'JPEG', 0, 0, pageWidth, pageHeight);
          } catch (err) {
            console.error('Failed to render blanko letterhead:', err);
          }
        }
      } else if (template.showClubHeader) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(30, 41, 59);
        doc.text(settings.clubName, marginLeft, 18);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `${settings.associationNumber ? settings.associationNumber + ' • ' : ''}${settings.taxOffice || 'Finanzamt'}${settings.taxNumber ? ' • St.-Nr.: ' + settings.taxNumber : ''}`,
          marginLeft,
          23
        );

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.line(marginLeft, 26, pageWidth - marginRight, 26);
      }
    };

    renderPageBackground();

    let currentY = marginTop;

    const checkPageBreak = (spaceNeeded: number) => {
      if (currentY + spaceNeeded > pageHeight - marginBottom) {
        doc.addPage();
        renderPageBackground();
        currentY = marginTop;
      }
    };

    // 1. Ort & Datum rechts oben
    const addressText = typeof settings.address === 'string' ? settings.address : (settings.address?.city || 'Musterstadt');
    const cityPart = typeof settings.address === 'string' && settings.address.includes(',') ? settings.address.split(',')[1].trim() : addressText;
    const issueDate = meeting.invitationDate ? formatDateGerman(meeting.invitationDate) : formatDateGerman(new Date().toISOString());

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${cityPart || 'Vereinssitz'}, den ${issueDate}`, pageWidth - marginRight, currentY, { align: 'right' });
    currentY += 8;

    // 2. Empfängerzeile
    let recipientLabel = 'An alle stimmberechtigten Mitglieder';
    if (meeting.type === 'board') {
      recipientLabel = 'An die Mitglieder des Vorstands';
    } else if (meeting.type === 'general_assembly' || meeting.type === 'extraordinary_assembly') {
      recipientLabel = `An alle Mitglieder des ${settings.clubName}`;
    } else if (meeting.type === 'committee') {
      recipientLabel = 'An die Mitglieder des Ausschusses / Fachbereichs';
    } else if (meeting.type === 'department') {
      recipientLabel = 'An die Mitglieder der Abteilung';
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    doc.text(recipientLabel, marginLeft, currentY);
    currentY += 8;

    // 3. Betreffzeile (Haupttitel)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(15, 23, 42);

    const isGeneral = meeting.type === 'general_assembly' || meeting.type === 'extraordinary_assembly';
    const mainSubject = isGeneral
      ? (meeting.type === 'extraordinary_assembly' ? 'EINLADUNG ZUR AUSSERORDENTLICHEN MITGLIEDERVERSAMMLUNG' : 'EINLADUNG ZUR ORDENTLICHEN MITGLIEDERVERSAMMLUNG')
      : `EINLADUNG: ${meeting.title.toUpperCase()}`;

    const subjectLines = doc.splitTextToSize(mainSubject, contentWidth);
    doc.text(subjectLines, marginLeft, currentY);
    currentY += subjectLines.length * 5.4 + 2;

    if (isGeneral && meeting.title && !meeting.title.toLowerCase().includes('mitgliederversammlung')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(79, 70, 229); // Indigo
      const tLines = doc.splitTextToSize(meeting.title, contentWidth);
      doc.text(tLines, marginLeft, currentY);
      currentY += tLines.length * 4.8 + 2;
    }

    // 4. Anrede & Ladungsformel
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    const salutation = meeting.type === 'board'
      ? 'Liebe Kolleginnen und Kollegen des Vorstands,'
      : 'Liebe Vereinsmitglieder, liebe Sportfreundinnen und Sportfreunde,';
    doc.text(salutation, marginLeft, currentY);
    currentY += 5.5;

    const openingFormula = `gemäß unserer Vereinssatzung laden wir Sie hiermit herzlich und form- sowie fristgerecht zu unserer ${formatMeetingType(meeting.type)} ein.`;
    const openingLines = doc.splitTextToSize(openingFormula, contentWidth);
    doc.text(openingLines, marginLeft, currentY);
    currentY += openingLines.length * 4.4 + 4;

    // 5. Rahmendaten-Box (Termin, Ort, Leitung) mit garantierter Randkontrolle & bündiger Textausrichtung
    const col1Width = 78;
    const col2Width = contentWidth - col1Width - 6; // ~86mm
    const col1X = marginLeft + 4;
    const col2X = marginLeft + col1Width + 6;
    const col1LabelW = 20;
    const col1ValW = col1Width - col1LabelW - 3; // ~55mm
    const col2LabelW = 28; // Ausreichend Platz für 'Versammlungsart:' (~22mm), garantiert keine Textüberschneidung
    const col2ValW = col2Width - col2LabelW - 4; // ~54mm

    // Formatiere und splitte alle Werte für kollisionsfreie Darstellung
    const invDateStr = formatDateGerman(meeting.date);
    const invDateLines = doc.splitTextToSize(invDateStr, col1ValW).slice(0, 1);

    const invTimeStr = `${meeting.startTime} Uhr${meeting.endTime ? ' – ca. ' + meeting.endTime + ' Uhr' : ''}`;
    const invTimeLines = doc.splitTextToSize(invTimeStr, col1ValW).slice(0, 1);

    const invLocStr = meeting.location || 'Vereinsheim';
    const invLocLines = doc.splitTextToSize(invLocStr, col1ValW).slice(0, 2);

    const invAdmissionStr = 'Akkreditierung ab 30 Min. vor Beginn';
    const invAdmissionLines = doc.splitTextToSize(invAdmissionStr, col1ValW).slice(0, 2);

    const invTypeStr = formatMeetingType(meeting.type);
    const invTypeLines = doc.splitTextToSize(invTypeStr, col2ValW).slice(0, 2);

    const invChairStr = meeting.chairperson || '1. Vorsitzender';
    const invChairLines = doc.splitTextToSize(invChairStr, col2ValW).slice(0, 2);

    const invMinuteStr = meeting.minuteKeeper || 'Schriftführer';
    const invMinuteLines = doc.splitTextToSize(invMinuteStr, col2ValW).slice(0, 2);

    const invVotingStr = 'Gemäß Satzung persönlich';
    const invVotingLines = doc.splitTextToSize(invVotingStr, col2ValW).slice(0, 2);

    const boxRowGap = 7.6;
    const boxHeight = Math.max(36, 5.5 + 3 * boxRowGap + 6.0);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.roundedRect(marginLeft, currentY, contentWidth, boxHeight, 2, 2, 'FD');

    let bY = currentY + 5.5;

    // Zeile 1: Datum | Versammlungsart
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('Datum:', col1X, bY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(invDateLines, col1X + col1LabelW, bY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Versammlungsart:', col2X, bY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(invTypeLines, col2X + col2LabelW, bY);

    // Zeile 2: Uhrzeit | Leitung
    bY += boxRowGap;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Uhrzeit:', col1X, bY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(invTimeLines, col1X + col1LabelW, bY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Leitung:', col2X, bY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(invChairLines, col2X + col2LabelW, bY);

    // Zeile 3: Ort | Protokollführung
    bY += boxRowGap;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Ort:', col1X, bY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(invLocLines, col1X + col1LabelW, bY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Protokoll:', col2X, bY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(invMinuteLines, col2X + col2LabelW, bY);

    // Zeile 4: Einlass | Stimmrecht
    bY += boxRowGap;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Einlass:', col1X, bY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(invAdmissionLines, col1X + col1LabelW, bY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Stimmrecht:', col2X, bY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(invVotingLines, col2X + col2LabelW, bY);

    currentY += boxHeight + 7;

    // 6. Tagesordnung gem. § 32 Abs. 1 S. 2 BGB
    checkPageBreak(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Vorläufige Tagesordnung gem. § 32 Abs. 1 Satz 2 BGB & Satzung:', marginLeft, currentY);
    currentY += 5.5;

    if (!meeting.agenda || meeting.agenda.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('(Es wurden noch keine Tagesordnungspunkte festgelegt)', marginLeft, currentY);
      currentY += 8;
    } else {
      meeting.agenda.forEach((top) => {
        const topTitleLines = doc.splitTextToSize(`${top.number}:  ${top.title}`, contentWidth - 10);
        const speakerLines = top.speaker ? doc.splitTextToSize(`Referent / Zuständig: ${top.speaker}`, contentWidth - 10) : [];

        const titleHeight = topTitleLines.length * 4.2;
        const speakerHeight = speakerLines.length > 0 ? (speakerLines.length * 3.6 + 1.5) : 0;
        const topCardHeight = 4.0 + titleHeight + speakerHeight + 2.5;

        checkPageBreak(topCardHeight + 2);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(marginLeft, currentY, contentWidth, topCardHeight, 1.5, 1.5, 'FD');

        let innerY = currentY + 4.2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        topTitleLines.forEach((tLine: string) => {
          doc.text(tLine, marginLeft + 4, innerY);
          innerY += 4.2;
        });

        if (speakerLines.length > 0) {
          innerY += 0.5;
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          speakerLines.forEach((sLine: string) => {
            doc.text(sLine, marginLeft + 4, innerY);
            innerY += 3.6;
          });
        }

        currentY += topCardHeight + 2.5;
      });
      currentY += 3.5;
    }

    // 7. Rechtliche Hinweise & Antragsfrist (§ 32 BGB)
    checkPageBreak(35);
    const motionDeadlineDays = options?.motionDeadlineDays || 7;
    let deadlineDateStr = '';
    try {
      const meetD = new Date(meeting.date);
      if (!isNaN(meetD.getTime())) {
        const dLine = new Date(meetD.getTime() - motionDeadlineDays * 24 * 60 * 60 * 1000);
        deadlineDateStr = formatDateGerman(dLine.toISOString().split('T')[0]);
      }
    } catch {
      // fallback
    }

    const noticeBoxTitle = 'Wichtige Hinweise zur Versammlung & Antragsfristen:';
    const noticePoints = [
      `• Anträge zur Tagesordnung: Anträge auf Ergänzung der Tagesordnung müssen gem. Satzung spätestens ${motionDeadlineDays} Tage vor der Versammlung${deadlineDateStr ? ' (bis zum ' + deadlineDateStr + ')' : ''} schriftlich beim Vorstand eingereicht werden. Spätere Anträge können in der Regel nicht mehr als beschlussfähig zugelassen werden.`,
      `• Stimmrecht & Vertretung: Stimmberechtigt sind alle ordentlichen Mitglieder gem. Satzung. Das Stimmrecht ist grundsätzlich persönlich auszuüben. Bitte halten Sie ggf. Ihren Mitgliedsausweis oder Personalausweis am Einlass bereit.`,
      `• Vorab-Einsichtnahme: Kassen- und Rechnungsberichte sowie Antragsunterlagen können auf Anfrage vorab bei der Geschäftsstelle eingesehen werden.`
    ];

    if (options?.customNotice) {
      noticePoints.push(`• Hinweis: ${options.customNotice}`);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const wrappedPoints = noticePoints.map(pt => doc.splitTextToSize(pt, contentWidth - 10));

    let totalLinesCount = 0;
    wrappedPoints.forEach(lines => { totalLinesCount += lines.length; });
    const noticeBoxH = 5.5 + 4.0 + (totalLinesCount * 3.8) + (wrappedPoints.length * 1.5) + 3.0;

    checkPageBreak(noticeBoxH + 4);

    doc.setFillColor(254, 252, 232); // Amber-50
    doc.setDrawColor(254, 240, 138); // Amber-200
    doc.setLineWidth(0.35);
    doc.roundedRect(marginLeft, currentY, contentWidth, noticeBoxH, 1.5, 1.5, 'FD');

    let nY = currentY + 4.8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(146, 64, 14);
    doc.text(noticeBoxTitle, marginLeft + 4, nY);
    nY += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 53, 15);
    wrappedPoints.forEach(ptLines => {
      ptLines.forEach((lStr: string) => {
        doc.text(lStr, marginLeft + 4, nY);
        nY += 3.8;
      });
      nY += 1.5;
    });

    currentY += noticeBoxH + 6;

    // 8. Grußformel & Unterschriften
    checkPageBreak(30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text('Mit freundlichen Vereinsgrüßen,', marginLeft, currentY);
    currentY += 4.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(`Für den Vorstand des ${settings.clubName} (§ 26 BGB):`, marginLeft, currentY);
    currentY += 13;

    const halfWidth = (contentWidth - 16) / 2;
    const sig1X = marginLeft;
    const sig2X = marginLeft + halfWidth + 16;

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.4);
    doc.line(sig1X, currentY, sig1X + halfWidth, currentY);
    doc.line(sig2X, currentY, sig2X + halfWidth, currentY);

    const sigChairLines = doc.splitTextToSize(meeting.chairperson || '1. Vorsitzender', halfWidth);
    const sigMinuteLines = doc.splitTextToSize(meeting.minuteKeeper || '2. Vorsitzender / Schriftführer', halfWidth);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(sigChairLines, sig1X, currentY + 4.5);
    doc.text(sigMinuteLines, sig2X, currentY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Versammlungsleitung gem. Satzung', sig1X, currentY + 9.0);
    doc.text('Vertretungsberechtigter Vorstand gem. § 26 BGB', sig2X, currentY + 9.0);

    // 9. Seitenzahlen unten
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Einladung: ${meeting.title} • Seite ${i} von ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    return doc;
  }
};
