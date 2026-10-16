import { describe, it, expect } from 'vitest';
import {
  adresszeilen,
  ermittleSteuerangaben,
  fehlendeSteuerangaben,
  standardOrtUndDatum,
  vereinsOrt
} from './donationService';
import { dateiEndung } from '../utils/fileExportHelper';
import { ClubSettings, DonationReceipt } from '../types';

const stammdaten = {
  clubName: 'Strelitzer FC e.V.',
  address: { street: 'Gottfried-Keller-Straße', houseNumber: '1', zip: '17235', city: 'Neustrelitz', country: 'Deutschland' },
  taxNumber: '075/142/03436',
  taxOffice: 'Waren (Müritz)',
  taxExemptionDate: '24.07.2025',
  taxStatementDate: '24.07.2025',
  taxAssessmentPeriod: '2022 - 2024',
  promotedPurposes: 'Förderung des Sports (§ 52 Abs. 2 Satz 1 Nr. 21 AO)'
} as unknown as ClubSettings;

function beleg(teil: Partial<DonationReceipt> = {}): DonationReceipt {
  return {
    id: 'a', receiptNumber: 'ZB-1', type: 'money', date: '2025-07-25', donorType: 'external', donorName: 'X',
    donorAddress: { street: '', houseNumber: '', zip: '', city: '', country: 'Deutschland' },
    amount: 1, amountInWords: 'ein Euro', isWaiverOfRefund: false,
    taxOffice: '', taxNumber: '', exemptionDate: '', assessmentPeriod: '', promotedPurpose: '',
    isDirectlyPromoted: true, issuedBy: '', cityAndDate: '', createdAt: '', updatedAt: '',
    ...teil
  };
}

describe('Steuerangaben für den Vordruck', () => {
  it('kommen aus den Vereinsstammdaten, wenn die Bescheinigung nichts Eigenes hat', () => {
    const a = ermittleSteuerangaben(beleg(), stammdaten);
    expect(a.finanzamt).toBe('Waren (Müritz)');
    expect(a.steuernummer).toBe('075/142/03436');
    expect(a.freistellungsDatum).toBe('24.07.2025');
    expect(a.feststellungsDatum).toBe('24.07.2025');
    expect(a.veranlagungszeitraum).toBe('2022 - 2024');
  });

  it('ändern sich mit den Stammdaten (neuer Freistellungsbescheid)', () => {
    const neu = { ...stammdaten, taxExemptionDate: '15.03.2027', taxAssessmentPeriod: '2024 - 2026' } as ClubSettings;
    const a = ermittleSteuerangaben(beleg(), neu);
    expect(a.freistellungsDatum).toBe('15.03.2027');
    expect(a.veranlagungszeitraum).toBe('2024 - 2026');
  });

  it('eine bereits ausgestellte Bescheinigung behält ihre gespeicherten Angaben', () => {
    const a = ermittleSteuerangaben(beleg({ exemptionDate: '2023-02-01', assessmentPeriod: '2020 - 2022' }), stammdaten);
    expect(a.freistellungsDatum).toBe('01.02.2023');
    expect(a.veranlagungszeitraum).toBe('2020 - 2022');
  });

  it('erfindet nichts: fehlt es in den Stammdaten, bleibt es leer', () => {
    const leer = { clubName: 'V', address: '' } as unknown as ClubSettings;
    const a = ermittleSteuerangaben(beleg(), leer);
    expect(a).toEqual({
      finanzamt: '', steuernummer: '', freistellungsDatum: '', veranlagungszeitraum: '',
      feststellungsDatum: '', zweckMitVerweis: '', zweckKurz: '', zweckSatzung: ''
    });
  });

  it('zerlegt den Zweck für die drei Stellen des Vordrucks', () => {
    const a = ermittleSteuerangaben(beleg(), stammdaten);
    expect(a.zweckMitVerweis).toBe('des Sports (§ 52 Abs. 2 Satz 1 Nr. 21 AO)');
    expect(a.zweckKurz).toBe('des Sports');
    expect(a.zweckSatzung).toBe('Förderung des Sports');
  });

  it('meldet fehlende Stammdaten', () => {
    expect(fehlendeSteuerangaben(stammdaten)).toEqual([]);
    const luecke = { ...stammdaten, taxNumber: '', taxExemptionDate: '', taxStatementDate: '', promotedPurposes: ' ' } as ClubSettings;
    expect(fehlendeSteuerangaben(luecke)).toEqual([
      'Steuernummer',
      'Datum Freistellungs- oder Feststellungsbescheid',
      'Steuerbegünstigte Zwecke'
    ]);
  });
});

describe('Ort und Adresse', () => {
  it('liest den Ort aus Objekt und Freitext', () => {
    expect(vereinsOrt(stammdaten.address)).toBe('Neustrelitz');
    expect(vereinsOrt('Gottfried-Keller-Straße 1, 17235 Neustrelitz')).toBe('Neustrelitz');
    expect(vereinsOrt('irgendwo')).toBe('');
    expect(vereinsOrt(undefined)).toBe('');
  });

  it('bildet „Ort, Datum“ ohne Platzhalter', () => {
    const d = new Date(2025, 6, 28);
    expect(standardOrtUndDatum(stammdaten, d)).toBe('Neustrelitz, 28.07.2025');
    expect(standardOrtUndDatum({ ...stammdaten, address: '' } as ClubSettings, d)).toBe('28.07.2025');
  });

  it('teilt die Vereinsadresse in Zeilen', () => {
    expect(adresszeilen(stammdaten.address)).toEqual(['Gottfried-Keller-Straße 1', '17235 Neustrelitz']);
    expect(adresszeilen('Musterweg 3, 12345 Beispielstadt')).toEqual(['Musterweg 3', '12345 Beispielstadt']);
    expect(adresszeilen(undefined)).toEqual([]);
  });
});

describe('Dateiendung', () => {
  it('erkennt die Endung', () => {
    expect(dateiEndung('a.PDF')).toBe('pdf');
    expect(dateiEndung('Bericht.final.csv')).toBe('csv');
    expect(dateiEndung('ohne')).toBe('');
  });
});
