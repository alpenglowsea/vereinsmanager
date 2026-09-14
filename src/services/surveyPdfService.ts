import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import { MemberSurvey, MemberSurveyToken, MemberSurveyResponse, ClubSettings } from '../types';
import { saveBlobWithLocationPicker, FileSaveResult } from '../utils/fileExportHelper';

export const SurveyPdfService = {
  /**
   * Exportiert die Liste aller personalisierten Einladungslinks als übersichtliches PDF
   * (Ohne QR-Codes, da vom Nutzer explizit abgewählt)
   */
  async exportSurveyTokensPdf(
    survey: MemberSurvey,
    tokens: MemberSurveyToken[],
    settings: ClubSettings,
    baseUrl: string
  ): Promise<FileSaveResult> {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const today = new Date().toLocaleDateString('de-DE');

    // Header
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, pageWidth, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(settings.clubName || 'VereinsManager', 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Mitgliederbefragung — Einladungs- & Zugangslink-Übersicht', 14, 18);

    doc.setFontSize(9);
    doc.text(`Erstellt am: ${today}`, pageWidth - 14, 14, { align: 'right' });

    // Survey Info
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Umfrage: ${survey.title}`, 14, 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const modeText = survey.useTokens
      ? 'Einmal-Token je Mitglied aktiviert (Verhindert Mehrfachabstimmung)'
      : 'Öffentliche Befragung ohne Einmal-Token';
    doc.text(
      `Modus: ${modeText} | Zielgruppe: ${survey.department === 'all' || !survey.department ? 'Gesamtverein' : survey.department} | Gesamt: ${tokens.length} Mitglieder | Abgestimmt: ${tokens.filter(t => t.isUsed).length} | Offen: ${tokens.filter(t => !t.isUsed).length}`,
      14,
      38
    );

    // Table
    const tableData = tokens.map(t => {
      const fullLink = `${baseUrl}?surveyId=${survey.id}&token=${t.token}`;
      const statusStr = t.isUsed
        ? `Abgestimmt (${t.usedAt ? new Date(t.usedAt).toLocaleDateString('de-DE') : 'ja'})`
        : 'Offen';
      return [
        t.memberNumber || '—',
        t.memberName,
        t.memberDepartment || '—',
        t.memberEmail || '—',
        fullLink,
        statusStr
      ];
    });

    autoTable(doc, {
      startY: 44,
      head: [['Mitgl.-Nr.', 'Name des Mitglieds', 'Sparte', 'E-Mail', 'Persönlicher Einladungslink (Einmal-Token)', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235], // blue-600
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 38 },
        2: { cellWidth: 26 },
        3: { cellWidth: 42 },
        4: { cellWidth: 110, font: 'courier', fontSize: 7 },
        5: { cellWidth: 32 }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const val = String(data.cell.raw);
          if (val.startsWith('Abgestimmt')) {
            data.cell.styles.textColor = [22, 101, 52]; // emerald-800
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [194, 65, 12]; // orange-700
          }
        }
      },
      didDrawPage: (data) => {
        // Footer
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Seite ${data.pageNumber} von ${doc.getNumberOfPages()} — ${settings.clubName} | Vertrauliche Einladungslinks`,
          pageWidth / 2,
          pageHeight - 6,
          { align: 'center' }
        );
      }
    });

    const pdfBlob = doc.output('blob');
    const safeTitle = survey.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    return await saveBlobWithLocationPicker(pdfBlob, `Umfrage_Einladungslinks_${safeTitle}.pdf`, {
      description: 'PDF-Dokument (*.pdf)',
      mimeType: 'application/pdf',
      extension: '.pdf'
    });
  },

  /**
   * Exportiert die Liste aller personalisierten Einladungslinks als CSV für Tabellenkalkulation
   */
  async exportSurveyTokensCsv(
    survey: MemberSurvey,
    tokens: MemberSurveyToken[],
    baseUrl: string
  ): Promise<FileSaveResult> {
    const data = tokens.map(t => ({
      'Mitgliedsnummer': t.memberNumber || '',
      'Name': t.memberName,
      'Sparte': t.memberDepartment || '',
      'E-Mail': t.memberEmail || '',
      'Telefon': t.memberPhone || '',
      'Einladungslink': `${baseUrl}?surveyId=${survey.id}&token=${t.token}`,
      'Einmal_Token': t.token,
      'Status': t.isUsed ? 'Abgestimmt' : 'Offen',
      'Abgestimmt_Am': t.usedAt ? new Date(t.usedAt).toLocaleString('de-DE') : ''
    }));

    const csv = Papa.unparse(data, { delimiter: ';' });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const safeTitle = survey.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);

    return await saveBlobWithLocationPicker(blob, `Umfrage_Links_${safeTitle}.csv`, {
      description: 'CSV-Tabelle (*.csv)',
      mimeType: 'text/csv',
      extension: '.csv'
    });
  },

  /**
   * Exportiert den vollständigen Auswertungsbericht der Befragung als PDF
   */
  async exportSurveyResultsPdf(
    survey: MemberSurvey,
    responses: MemberSurveyResponse[],
    tokens: MemberSurveyToken[],
    settings: ClubSettings
  ): Promise<FileSaveResult> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const today = new Date().toLocaleDateString('de-DE');

    // Header bar
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, pageWidth, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(settings.clubName || 'VereinsManager', 14, 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('Auswertungsbericht — Mitgliederbefragung & Meinungsbild', 14, 17);

    doc.setFontSize(8.5);
    doc.text(`Stand: ${today}`, pageWidth - 14, 14, { align: 'right' });

    // Survey Overview
    let currentY = 32;
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(survey.title, 14, currentY);

    currentY += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const splitDesc = doc.splitTextToSize(survey.description, pageWidth - 28);
    doc.text(splitDesc, 14, currentY);
    currentY += splitDesc.length * 4.5 + 4;

    // KPI Summary Box
    const totalInvited = survey.useTokens && tokens.length > 0 ? tokens.length : responses.length;
    const totalVotes = responses.length;
    const returnRate = totalInvited > 0 ? ((totalVotes / totalInvited) * 100).toFixed(1) : '0';

    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(14, currentY, pageWidth - 28, 18, 2, 2, 'F');

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Ergebnis-Zusammenfassung:', 18, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(
      `Eingegangene Antworten: ${totalVotes} | Rücklaufquote: ${returnRate} % ${survey.useTokens ? `(von ${totalInvited} eingeladenen Mitgliedern)` : ''}`,
      18,
      currentY + 12
    );
    doc.text(
      `Anonymität: ${survey.anonymous ? 'Ja (Vollständig anonymisiert)' : 'Nein'} | Zeitraum: ${survey.startDate || '—'} bis ${survey.endDate || 'offen'}`,
      pageWidth - 18,
      currentY + 12,
      { align: 'right' }
    );

    currentY += 24;

    // Loop through questions and render summary tables
    survey.questions.forEach((q, qIndex) => {
      // Check page overflow
      if (currentY > pageHeight - 45) {
        doc.addPage();
        currentY = 20;
      }

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(`Frage ${qIndex + 1}: ${q.title}`, 14, currentY);

      currentY += 4.5;
      if (q.description) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(q.description, 14, currentY);
        currentY += 4;
      }

      // Collect answers for this question
      const rawAnswers = responses
        .map(r => r.answers[q.id])
        .filter(val => val !== undefined && val !== null && val !== '');

      if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        const counts: Record<string, number> = {};
        const options = q.options || [];
        options.forEach(opt => { counts[opt] = 0; });

        rawAnswers.forEach(ans => {
          if (Array.isArray(ans)) {
            ans.forEach(val => {
              counts[val] = (counts[val] || 0) + 1;
            });
          } else {
            counts[ans] = (counts[ans] || 0) + 1;
          }
        });

        const totalAnswersForQuestion = rawAnswers.length || 1;
        const rows = options.map(opt => {
          const c = counts[opt] || 0;
          const pct = ((c / totalAnswersForQuestion) * 100).toFixed(1);
          return [opt, `${c} Stimmen`, `${pct} %`];
        });

        autoTable(doc, {
          startY: currentY,
          head: [['Antwortoption', 'Stimmenanzahl', 'Anteil (%)']],
          body: rows,
          theme: 'striped',
          headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 120 },
            1: { cellWidth: 32, halign: 'right' },
            2: { cellWidth: 30, halign: 'right' }
          },
          margin: { left: 14, right: 14 }
        });
        // @ts-expect-error - jspdf-autotable modifies doc.lastAutoTable
        currentY = doc.lastAutoTable.finalY + 8;
      } else if (q.type === 'rating_stars') {
        const numericAnswers = rawAnswers.map(a => Number(a)).filter(n => !isNaN(n) && n > 0);
        const avg = numericAnswers.length > 0
          ? (numericAnswers.reduce((sum, v) => sum + v, 0) / numericAnswers.length).toFixed(2)
          : '—';

        const starCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        numericAnswers.forEach(n => {
          if (starCounts[n] !== undefined) starCounts[n]++;
        });

        const rows = [5, 4, 3, 2, 1].map(stars => {
          const c = starCounts[stars] || 0;
          const pct = numericAnswers.length > 0 ? ((c / numericAnswers.length) * 100).toFixed(1) : '0';
          return [`${stars} Sterne`, `${c} Stimmen`, `${pct} %`];
        });

        rows.push(['Gesamtdurchschnitt', `${avg} von 5.0 Sternen`, '100 %']);

        autoTable(doc, {
          startY: currentY,
          head: [['Bewertungsstufe', 'Häufigkeit', 'Anteil (%)']],
          body: rows,
          theme: 'striped',
          headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 120 },
            1: { cellWidth: 32, halign: 'right' },
            2: { cellWidth: 30, halign: 'right' }
          },
          margin: { left: 14, right: 14 }
        });
        // @ts-expect-error - jspdf-autotable modifies doc.lastAutoTable
        currentY = doc.lastAutoTable.finalY + 8;
      } else if (q.type === 'scale_10') {
        const numericAnswers = rawAnswers.map(a => Number(a)).filter(n => !isNaN(n) && n >= 0 && n <= 10);
        const avg = numericAnswers.length > 0
          ? (numericAnswers.reduce((sum, v) => sum + v, 0) / numericAnswers.length).toFixed(2)
          : '—';

        // NPS breakdown
        const promoters = numericAnswers.filter(n => n >= 9).length;
        const passives = numericAnswers.filter(n => n >= 7 && n <= 8).length;
        const detractors = numericAnswers.filter(n => n <= 6).length;
        const totalNps = numericAnswers.length || 1;
        const npsScore = Math.round(((promoters - detractors) / totalNps) * 100);

        const rows = [
          ['Promotoren (Wertung 9–10)', `${promoters} Stimmen`, `${((promoters / totalNps) * 100).toFixed(1)} %`],
          ['Passive (Wertung 7–8)', `${passives} Stimmen`, `${((passives / totalNps) * 100).toFixed(1)} %`],
          ['Detraktoren (Wertung 0–6)', `${detractors} Stimmen`, `${((detractors / totalNps) * 100).toFixed(1)} %`],
          ['Net Promoter Score (NPS)', `${npsScore > 0 ? '+' : ''}${npsScore}`, 'NPS Index'],
          ['Durchschnittswert', `${avg} von 10.0 Punkten`, 'Mittelwert']
        ];

        autoTable(doc, {
          startY: currentY,
          head: [['Kategorie / Wertung', 'Ergebnis', 'Kennzahl']],
          body: rows,
          theme: 'striped',
          headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 120 },
            1: { cellWidth: 32, halign: 'right' },
            2: { cellWidth: 30, halign: 'right' }
          },
          margin: { left: 14, right: 14 }
        });
        // @ts-expect-error - jspdf-autotable modifies doc.lastAutoTable
        currentY = doc.lastAutoTable.finalY + 8;
      } else if (q.type === 'yes_no') {
        const yesCount = rawAnswers.filter(a => a === 'yes').length;
        const noCount = rawAnswers.filter(a => a === 'no').length;
        const abstainCount = rawAnswers.filter(a => a === 'abstain').length;
        const total = rawAnswers.length || 1;

        const rows = [
          ['Ja', `${yesCount} Stimmen`, `${((yesCount / total) * 100).toFixed(1)} %`],
          ['Nein', `${noCount} Stimmen`, `${((noCount / total) * 100).toFixed(1)} %`],
          ['Enthaltung', `${abstainCount} Stimmen`, `${((abstainCount / total) * 100).toFixed(1)} %`]
        ];

        autoTable(doc, {
          startY: currentY,
          head: [['Antwort', 'Stimmenanzahl', 'Anteil (%)']],
          body: rows,
          theme: 'striped',
          headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 120 },
            1: { cellWidth: 32, halign: 'right' },
            2: { cellWidth: 30, halign: 'right' }
          },
          margin: { left: 14, right: 14 }
        });
        // @ts-expect-error - jspdf-autotable modifies doc.lastAutoTable
        currentY = doc.lastAutoTable.finalY + 8;
      } else {
        // Freitext
        const textAnswers = rawAnswers.map(a => String(a).trim()).filter(a => a.length > 0);
        const rows = textAnswers.slice(0, 15).map((txt, idx) => [`#${idx + 1}`, txt]);
        if (textAnswers.length === 0) {
          rows.push(['—', 'Keine Freitext-Antworten eingegangen']);
        }

        autoTable(doc, {
          startY: currentY,
          head: [['Nr.', `Eingegangene Rückmeldungen (${textAnswers.length} Antworten)`]],
          body: rows,
          theme: 'striped',
          headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 16 },
            1: { cellWidth: 166 }
          },
          margin: { left: 14, right: 14 }
        });
        // @ts-expect-error - jspdf-autotable modifies doc.lastAutoTable
        currentY = doc.lastAutoTable.finalY + 8;
      }
    });

    // Add page numbers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Seite ${i} von ${totalPages} — ${settings.clubName} | Umfrage-Auswertungsbericht`,
        pageWidth / 2,
        pageHeight - 6,
        { align: 'center' }
      );
    }

    const pdfBlob = doc.output('blob');
    const safeTitle = survey.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    return await saveBlobWithLocationPicker(pdfBlob, `Auswertung_Befragung_${safeTitle}.pdf`, {
      description: 'PDF-Dokument (*.pdf)',
      mimeType: 'application/pdf',
      extension: '.pdf'
    });
  },

  /**
   * Exportiert die Rohdaten aller Antworten als CSV für Excel
   */
  async exportSurveyResponsesCsv(
    survey: MemberSurvey,
    responses: MemberSurveyResponse[]
  ): Promise<FileSaveResult> {
    const data = responses.map((r, idx) => {
      const row: Record<string, any> = {
        'Antwort_ID': r.id || `R-${idx + 1}`,
        'Eingereicht_Am': new Date(r.submittedAt).toLocaleString('de-DE')
      };

      if (!survey.anonymous && r.memberName) {
        row['Mitglied_Name'] = r.memberName;
      }

      survey.questions.forEach((q, qIdx) => {
        const val = r.answers[q.id];
        const colTitle = `F${qIdx + 1}_${q.title.substring(0, 35)}`;
        if (Array.isArray(val)) {
          row[colTitle] = val.join(', ');
        } else if (val === undefined || val === null) {
          row[colTitle] = '';
        } else {
          row[colTitle] = String(val);
        }
      });

      return row;
    });

    const csv = Papa.unparse(data, { delimiter: ';' });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const safeTitle = survey.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);

    return await saveBlobWithLocationPicker(blob, `Rohdaten_Befragung_${safeTitle}.csv`, {
      description: 'CSV-Tabelle (*.csv)',
      mimeType: 'text/csv',
      extension: '.csv'
    });
  }
};
