import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Member,
  ClubSettings,
  SepaCollectionItem,
  SepaRunConfig,
  SepaPeriodFilter,
  FeePeriod
} from '../types';

export const SepaService = {
  /**
   * Validates an IBAN using the MOD-97-10 checksum algorithm (ISO 7064)
   */
  validateIban(rawIban: string): { isValid: boolean; formatted: string; country: string; error?: string } {
    if (!rawIban) {
      return { isValid: false, formatted: '', country: '', error: 'IBAN fehlt' };
    }

    const clean = rawIban.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length < 15 || clean.length > 34) {
      return { isValid: false, formatted: clean, country: clean.slice(0, 2), error: 'Ungültige Länge (15-34 Zeichen erforderlich)' };
    }

    const country = clean.slice(0, 2);
    // Standard length checks for DACH & EU
    const standardLengths: Record<string, number> = {
      DE: 22,
      AT: 20,
      CH: 21,
      FR: 27,
      NL: 18,
      IT: 27,
      ES: 24,
      BE: 16,
      LU: 20
    };

    if (standardLengths[country] && clean.length !== standardLengths[country]) {
      return {
        isValid: false,
        formatted: clean,
        country,
        error: `IBAN für ${country} muss genau ${standardLengths[country]} Zeichen lang sein (aktuell: ${clean.length})`
      };
    }

    // Rearrange: move first 4 chars to end
    const rearranged = clean.slice(4) + clean.slice(0, 4);

    // Convert letters to numbers: A=10, B=11, ... Z=35
    let numeric = '';
    for (let i = 0; i < rearranged.length; i++) {
      const code = rearranged.charCodeAt(i);
      if (code >= 65 && code <= 90) {
        numeric += (code - 55).toString();
      } else {
        numeric += rearranged[i];
      }
    }

    // Perform modulo 97 with chunking to avoid integer overflow
    let remainder = 0;
    for (let i = 0; i < numeric.length; i += 7) {
      const chunk = remainder.toString() + numeric.slice(i, i + 7);
      remainder = parseInt(chunk, 10) % 97;
    }

    const isValid = remainder === 1;
    // Format nicely with space every 4 chars
    const formatted = clean.match(/.{1,4}/g)?.join(' ') || clean;

    return {
      isValid,
      formatted,
      country,
      error: isValid ? undefined : 'Ungültige IBAN-Prüfziffer'
    };
  },

  /**
   * Validates standard BIC format (8 or 11 chars)
   */
  validateBic(bic?: string): boolean {
    if (!bic || !bic.trim()) return true; // BIC is optional in SEPA single euro payments area since IBAN-only rule
    const clean = bic.toUpperCase().trim();
    const regex = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
    return regex.test(clean);
  },

  /**
   * Sanitize text according to SEPA/ISO 20022 character set rules.
   * Replaces German umlauts and removes illegal characters.
   */
  sanitizeText(text: string, maxLength = 140): string {
    if (!text) return '';
    let res = text
      .replace(/Ä/g, 'Ae')
      .replace(/Ö/g, 'Oe')
      .replace(/Ü/g, 'Ue')
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/&/g, '+')
      .replace(/[^\w\s\+\-\/\?:().,']/g, '') // ISO 20022 allowed subset
      .trim();

    if (maxLength && res.length > maxLength) {
      res = res.slice(0, maxLength);
    }
    return res;
  },

  /**
   * Escapes XML characters
   */
  escapeXml(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  },

  /**
   * Format date to YYYY-MM-DD
   */
  formatDate(date: Date | string): string {
    if (typeof date === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
      const d = new Date(date);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      return new Date().toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0];
  },

  /**
   * Calculates the debit amount for a member based on fee period and run filter
   */
  calculateCollectionAmount(member: Member, filter: SepaPeriodFilter): number {
    const rawFee = member.feeAmount || 0;
    if (rawFee <= 0) return 0;

    // If filter is for monthly collection (1st or 15th)
    if (filter === 'monthly_1' || filter === 'monthly_15' || filter === 'monthly_all') {
      if (member.feePeriod === 'monthly') return rawFee;
      if (member.feePeriod === 'yearly') return parseFloat((rawFee / 12).toFixed(2));
      if (member.feePeriod === 'quarterly') return parseFloat((rawFee / 3).toFixed(2));
      if (member.feePeriod === 'half_yearly') return parseFloat((rawFee / 6).toFixed(2));
    }

    // If filter is quarterly
    if (filter === 'quarterly') {
      if (member.feePeriod === 'quarterly') return rawFee;
      if (member.feePeriod === 'yearly') return parseFloat((rawFee / 4).toFixed(2));
      if (member.feePeriod === 'monthly') return parseFloat((rawFee * 3).toFixed(2));
      if (member.feePeriod === 'half_yearly') return parseFloat((rawFee / 2).toFixed(2));
    }

    // If filter is half-yearly
    if (filter === 'half_yearly') {
      if (member.feePeriod === 'half_yearly') return rawFee;
      if (member.feePeriod === 'yearly') return parseFloat((rawFee / 2).toFixed(2));
      if (member.feePeriod === 'monthly') return parseFloat((rawFee * 6).toFixed(2));
      if (member.feePeriod === 'quarterly') return parseFloat((rawFee * 2).toFixed(2));
    }

    // If filter is yearly
    if (filter === 'yearly') {
      if (member.feePeriod === 'yearly') return rawFee;
      if (member.feePeriod === 'monthly') return parseFloat((rawFee * 12).toFixed(2));
      if (member.feePeriod === 'quarterly') return parseFloat((rawFee * 4).toFixed(2));
      if (member.feePeriod === 'half_yearly') return parseFloat((rawFee * 2).toFixed(2));
    }

    // Fallback: full nominal fee
    return rawFee;
  },

  /**
   * Previews and builds collection items from member database
   */
  buildCollectionItems(
    members: Member[],
    config: Partial<SepaRunConfig>
  ): SepaCollectionItem[] {
    const filter = config.periodFilter || 'monthly_1';
    const targetYear = config.targetYear || new Date().getFullYear();
    const targetMonth = config.targetMonth || (new Date().getMonth() + 1);
    const monthStr = targetMonth.toString().padStart(2, '0');

    // Filter members that:
    // 1. Are active (or honorary with fee)
    // 2. Have paymentMethod === 'sepa'
    // 3. Match the period filter
    return members
      .filter(m => {
        // Exclude terminated or suspended members
        if (m.status === 'terminated') return false;
        // Must use SEPA
        if (m.paymentMethod !== 'sepa') return false;

        // Specific filter matching
        if (filter === 'monthly_1') {
          // Member must be monthly AND due on 1st (default to 1 if not specified)
          if (m.feePeriod !== 'monthly') return false;
          const dueDay = m.bankDetails?.monthlyDueDay || 1;
          return dueDay === 1;
        }

        if (filter === 'monthly_15') {
          // Member must be monthly AND due on 15th
          if (m.feePeriod !== 'monthly') return false;
          const dueDay = m.bankDetails?.monthlyDueDay || 1;
          return dueDay === 15;
        }

        if (filter === 'monthly_all') {
          return m.feePeriod === 'monthly';
        }

        if (filter === 'quarterly') {
          return m.feePeriod === 'quarterly';
        }

        if (filter === 'half_yearly') {
          return m.feePeriod === 'half_yearly';
        }

        if (filter === 'yearly') {
          return m.feePeriod === 'yearly';
        }

        return true;
      })
      .map(m => {
        const amount = this.calculateCollectionAmount(m, filter);
        const validationErrors: string[] = [];

        // Validate IBAN
        const ibanCheck = this.validateIban(m.bankDetails?.iban || '');
        if (!ibanCheck.isValid) {
          validationErrors.push(ibanCheck.error || 'Ungültige IBAN');
        }

        // Validate BIC
        if (m.bankDetails?.bic && !this.validateBic(m.bankDetails.bic)) {
          validationErrors.push('Ungültiger BIC-Code');
        }

        // Validate Mandate Reference
        const mandateRef = m.bankDetails?.mandateReference?.trim() || `MANDAT-${m.memberNumber}`;
        if (!mandateRef) {
          validationErrors.push('Mandatsreferenz fehlt');
        }

        // Validate Mandate Date
        const mandateDate = m.bankDetails?.mandateDate || m.entryDate || '';
        if (!mandateDate) {
          validationErrors.push('Datum der Mandatsunterzeichnung fehlt');
        }

        // Validate Account Holder
        const accountHolder = (m.bankDetails?.accountHolder || `${m.firstName} ${m.lastName}`).trim();
        if (!accountHolder) {
          validationErrors.push('Kontoinhaber fehlt');
        }

        if (amount <= 0) {
          validationErrors.push('Beitrag ist 0,00 €');
        }

        // Build Remittance Information (Verwendungszweck)
        let periodLabel = `${monthStr}/${targetYear}`;
        if (filter === 'quarterly') {
          const q = config.targetQuarter || Math.ceil(targetMonth / 3);
          periodLabel = `Q${q}/${targetYear}`;
        } else if (filter === 'half_yearly') {
          const h = config.targetHalfYear || (targetMonth <= 6 ? 1 : 2);
          periodLabel = `H${h}/${targetYear}`;
        } else if (filter === 'yearly') {
          periodLabel = `${targetYear}`;
        }

        let customRemittance = config.remittanceTemplate || 'Mitgliedsbeitrag {PERIOD} {MEMBER_NO} {NAME}';
        customRemittance = customRemittance
          .replace('{PERIOD}', periodLabel)
          .replace('{MEMBER_NO}', m.memberNumber)
          .replace('{NAME}', `${m.lastName}, ${m.firstName}`)
          .replace('{YEAR}', targetYear.toString())
          .replace('{DEPT}', m.department || '');

        const sanitizedRemittance = this.sanitizeText(customRemittance, 140);
        const endToEndId = `E2E-${m.memberNumber}-${targetYear}${monthStr}-${Math.floor(Math.random() * 1000)}`.replace(/[^a-zA-Z0-9-]/g, '');

        const isValid = validationErrors.length === 0;

        return {
          memberId: m.id,
          memberNumber: m.memberNumber,
          memberName: `${m.lastName}, ${m.firstName}`,
          accountHolder,
          iban: (m.bankDetails?.iban || '').toUpperCase().replace(/\s/g, ''),
          bic: (m.bankDetails?.bic || '').toUpperCase().trim(),
          bankName: m.bankDetails?.bankName,
          mandateReference: mandateRef,
          mandateDate: this.formatDate(mandateDate),
          sequenceType: m.bankDetails?.mandateSequenceType || 'RCUR',
          amount,
          feePeriod: m.feePeriod,
          monthlyDueDay: m.bankDetails?.monthlyDueDay || (filter === 'monthly_15' ? 15 : 1),
          remittanceInfo: sanitizedRemittance,
          endToEndId,
          isValid,
          validationErrors,
          selected: isValid // Selected by default if valid
        };
      });
  },

  /**
   * Generates a fully compliant SEPA pain.008.001.02 XML file (EPC & DK standard)
   */
  generateSepaXml(config: SepaRunConfig, items: SepaCollectionItem[]): string {
    const activeItems = items.filter(i => i.selected && i.isValid && i.amount > 0);
    if (activeItems.length === 0) {
      throw new Error('Keine gültigen Lastschriftposten ausgewählt.');
    }

    const totalAmount = activeItems.reduce((sum, item) => sum + item.amount, 0);
    const count = activeItems.length;
    const now = new Date();
    const creDtTm = now.toISOString().split('.')[0]; // YYYY-MM-DDTHH:MM:SS
    const msgId = `MSG-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`;
    const pmtInfId = `PMT-${config.periodFilter}-${config.targetYear}-${config.executionDate}`;

    const cleanCreditorIban = config.creditorIban.toUpperCase().replace(/\s/g, '');
    const cleanCreditorBic = config.creditorBic?.toUpperCase().trim();
    const cleanCreditorId = config.creditorId.toUpperCase().trim();
    const sanitizedClubName = this.sanitizeText(config.creditorName || 'Verein', 70);

    // Build Transaction XML items
    const txXmlParts = activeItems.map(item => {
      const sanitizedDebtorName = this.sanitizeText(item.accountHolder, 70);
      const sanitizedRemittance = this.sanitizeText(item.remittanceInfo, 140);
      const cleanDebtorIban = item.iban.toUpperCase().replace(/\s/g, '');
      const cleanDebtorBic = item.bic ? item.bic.toUpperCase().trim() : '';

      return `      <DrctDbtTxInf>
        <PmtId>
          <EndToEndId>${this.escapeXml(item.endToEndId)}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="EUR">${item.amount.toFixed(2)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${this.escapeXml(item.mandateReference)}</MndtId>
            <DtOfSgntr>${this.formatDate(item.mandateDate)}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt>
          <FinInstnId>
            ${cleanDebtorBic ? `<BIC>${cleanDebtorBic}</BIC>` : '<Othr><Id>NOTPROVIDED</Id></Othr>'}
          </FinInstnId>
        </DbtrAgt>
        <Dbtr>
          <Nm>${this.escapeXml(sanitizedDebtorName)}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id>
            <IBAN>${cleanDebtorIban}</IBAN>
          </Id>
        </DbtrAcct>
        <RmtInf>
          <Ustrd>${this.escapeXml(sanitizedRemittance)}</Ustrd>
        </RmtInf>
      </DrctDbtTxInf>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02 pain.008.001.02.xsd">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${this.escapeXml(msgId)}</MsgId>
      <CreDtTm>${creDtTm}</CreDtTm>
      <NbOfTxs>${count}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>${this.escapeXml(sanitizedClubName)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${this.escapeXml(pmtInfId)}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>${count}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
        <LclInstrm>
          <Cd>CORE</Cd>
        </LclInstrm>
        <SeqTp>RCUR</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${this.formatDate(config.executionDate)}</ReqdColltnDt>
      <Cdtr>
        <Nm>${this.escapeXml(sanitizedClubName)}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <IBAN>${cleanCreditorIban}</IBAN>
        </Id>
      </CdtrAcct>
      <CdtrAgt>
        <FinInstnId>
          ${cleanCreditorBic ? `<BIC>${cleanCreditorBic}</BIC>` : '<Othr><Id>NOTPROVIDED</Id></Othr>'}
        </FinInstnId>
      </CdtrAgt>
      <CdtrSchmeId>
        <Id>
          <PrvtId>
            <Othr>
              <Id>${this.escapeXml(cleanCreditorId)}</Id>
              <SchmeNm>
                <Prtry>SEPA</Prtry>
              </SchmeNm>
            </Othr>
          </PrvtId>
        </Id>
      </CdtrSchmeId>
${txXmlParts.join('\n')}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;

    return xml;
  },

  /**
   * Browser download trigger for XML files
   */
  downloadSepaXmlFile(xmlContent: string, filename: string): void {
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.xml') ? filename : `${filename}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Generates an auditor-ready PDF protocol for the direct debit run
   */
  exportSepaPdfReport(
    config: SepaRunConfig,
    items: SepaCollectionItem[],
    settings: ClubSettings
  ): void {
    const activeItems = items.filter(i => i.selected);
    const totalAmount = activeItems.reduce((s, i) => s + i.amount, 0);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Club Header
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(settings.clubName, 14, 16);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${settings.address} | Gläubiger-ID: ${settings.creditorId}`, 14, 21);
    doc.text(`Vereinskonto: ${settings.creditorIban || '–'} (${settings.creditorBic || '–'})`, 14, 26);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(14, 29, 196, 29);

    // Title
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('SEPA-Basislastschrift: Beitrags-Einzugsprotokoll', 14, 37);

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Fälligkeitsdatum: ${new Date(config.executionDate).toLocaleDateString('de-DE')} | Erstellt: ${new Date().toLocaleDateString('de-DE')}`,
      14,
      43
    );

    // Summary Box
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 48, 182, 18, 'F');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`Gesamtsumme Einzug:`, 18, 55);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${totalAmount.toFixed(2)} €`, 18, 62);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Anzahl Lastschriften:`, 85, 55);
    doc.setFont('helvetica', 'bold');
    doc.text(`${activeItems.length} Posten`, 85, 62);

    doc.setFont('helvetica', 'normal');
    doc.text(`Beitragszyklus:`, 140, 55);
    doc.setFont('helvetica', 'bold');
    let cycleName = 'Monatlich (1. des Monats)';
    if (config.periodFilter === 'monthly_15') cycleName = 'Monatlich (15. des Monats)';
    else if (config.periodFilter === 'monthly_all') cycleName = 'Monatlich (Alle)';
    else if (config.periodFilter === 'quarterly') cycleName = `Quartal Q${config.targetQuarter || 1}`;
    else if (config.periodFilter === 'half_yearly') cycleName = `Halbjahr H${config.targetHalfYear || 1}`;
    else if (config.periodFilter === 'yearly') cycleName = `Jahresbeitrag ${config.targetYear}`;
    doc.text(cycleName, 140, 62);

    // Table
    const tableRows = activeItems.map((item, idx) => [
      (idx + 1).toString(),
      item.memberNumber,
      item.memberName,
      item.accountHolder !== item.memberName ? `${item.accountHolder}*` : item.accountHolder,
      item.iban ? `${item.iban.slice(0, 6)}...${item.iban.slice(-4)}` : '–',
      item.mandateReference,
      `${item.amount.toFixed(2)} €`
    ]);

    autoTable(doc, {
      startY: 72,
      head: [['#', 'Mgl-Nr.', 'Mitglied', 'Kontoinhaber', 'IBAN (maskiert)', 'Mandatsreferenz', 'Betrag']],
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
        cellPadding: 1.8,
        textColor: [40, 40, 40]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 18 },
        2: { cellWidth: 38 },
        3: { cellWidth: 38 },
        4: { cellWidth: 32 },
        5: { cellWidth: 26 },
        6: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
      },
      didDrawPage: data => {
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(
          `Seite ${data.pageNumber} | ${settings.clubName} - SEPA Lastschrifteinzug (${config.executionDate})`,
          14,
          doc.internal.pageSize.height - 8
        );
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;
    if (finalY < 255) {
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('* Weicht vom Namen des Mitglieds ab (z.B. Erziehungsberechtigte/r)', 14, finalY);

      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text('Kassenprüfung & Freigabe zur Bankeinreichung:', 14, finalY + 8);

      doc.setDrawColor(180, 180, 180);
      doc.line(14, finalY + 22, 80, finalY + 22);
      doc.line(115, finalY + 22, 180, finalY + 22);

      doc.setFontSize(7.5);
      doc.text(`Ort, Datum (${new Date().toLocaleDateString('de-DE')})`, 14, finalY + 26);
      doc.text(`Kassenwart / Schatzmeister: ${settings.treasurer}`, 115, finalY + 26);
    }

    doc.save(`SEPA_Einzugsprotokoll_${config.executionDate}_${config.periodFilter}.pdf`);
  }
};
