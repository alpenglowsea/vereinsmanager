import { describe, it, expect } from 'vitest';
import {
  baueSpendenTabelle,
  baueSpendenCsv,
  baueSpendenXlsx,
  csvTextSicher,
  deutscherBetrag,
  deutschesDatum,
  dateinameTeil,
  pdfDateinamen,
  SPENDEN_SPALTEN
} from './donationExport';
import { DonationReceipt } from '../types';

function spende(teil: Partial<DonationReceipt> = {}): DonationReceipt {
  return {
    id: 'a',
    receiptNumber: 'ZB-2025-001',
    type: 'money',
    date: '2025-03-15',
    donorType: 'external',
    donorName: 'Müller & Söhne',
    donorAddress: { street: 'Hauptstraße', houseNumber: '1', zip: '01067', city: 'Dresden', country: 'Deutschland' },
    amount: 1234.5,
    amountInWords: 'Eintausendzweihundertvierunddreißig',
    isWaiverOfRefund: false,
    taxOffice: 'FA Dresden',
    taxNumber: '123/456/78901',
    exemptionDate: '2024-01-31',
    assessmentPeriod: '2022-2024',
    promotedPurpose: 'Sport',
    isDirectlyPromoted: true,
    issuedBy: 'Vorstand',
    cityAndDate: 'Dresden, 16.03.2025',
    createdAt: '2025-03-15',
    updatedAt: '2025-03-15',
    ...teil
  };
}

describe('Spenden-Export', () => {
  it('jede Zeile hat so viele Werte wie Spalten', () => {
    const t = baueSpendenTabelle([spende(), spende({ type: 'goods', goodsOrigin: 'private', goodsDescription: 'Tisch' })]);
    expect(t).toHaveLength(2);
    for (const z of t) expect(z).toHaveLength(SPENDEN_SPALTEN.length);
    expect(t[1][13]).toBe('Tisch');
    expect(t[1][14]).toBe('Privatvermögen');
    expect(t[0][13]).toBe('');
  });

  it('formatiert Datum und Betrag deutsch', () => {
    expect(deutschesDatum('2025-03-15')).toBe('15.03.2025');
    expect(deutschesDatum('')).toBe('');
    expect(deutscherBetrag(1234.5)).toBe('1234,50');
    expect(deutscherBetrag(0)).toBe('0,00');
  });

  it('schützt vor Formeln in CSV-Zellen', () => {
    expect(csvTextSicher('=SUMME(A1)')).toBe("'=SUMME(A1)");
    expect(csvTextSicher('+49 123')).toBe("'+49 123");
    expect(csvTextSicher('@x')).toBe("'@x");
    expect(csvTextSicher('Meier')).toBe('Meier');
  });

  it('CSV: Semikolon, deutsches Komma und Datum, Kopfzeile vorn', () => {
    const csv = baueSpendenCsv([spende({ donorName: '=böse' })]);
    const zeilen = csv.split('\r\n');
    expect(zeilen[0].startsWith('Beleg-Nr.;Art;Datum der Zuwendung;Spender')).toBe(true);
    expect(zeilen[1]).toContain('ZB-2025-001;Geldzuwendung;15.03.2025;\'=böse');
    expect(zeilen[1]).toContain(';1234,50;');
    expect(zeilen[1]).toContain(';31.01.2024;');
  });

  it('Excel-Datei ist ein ZIP mit Tabelle', () => {
    const x = baueSpendenXlsx([spende()]);
    expect(x[0]).toBe(0x50); // „PK“
    expect(x[1]).toBe(0x4b);
  });

  it('Dateinamen: Umlaute ausschreiben, eindeutig machen', () => {
    expect(dateinameTeil('Müller & Söhne / GmbH')).toBe('Mueller_Soehne_GmbH');
    const namen = pdfDateinamen([spende(), spende(), spende({ receiptNumber: 'ZB-2025-002' })]);
    expect(namen[0]).toBe('Zuwendungsbestaetigung_ZB-2025-001_Mueller_Soehne.pdf');
    expect(namen[1]).toBe('Zuwendungsbestaetigung_ZB-2025-001_Mueller_Soehne_2.pdf');
    expect(new Set(namen).size).toBe(3);
  });
});
