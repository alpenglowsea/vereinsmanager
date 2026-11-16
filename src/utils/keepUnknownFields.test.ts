import { describe, it, expect } from 'vitest';
import { keepUnknownFields } from './keepUnknownFields';

interface Probe {
  id: string;
  name: string;
  notes?: string;
  bank?: { iban: string; bic?: string };
  address?: { city: string };
}

describe('keepUnknownFields', () => {
  it('gibt einen neuen Datensatz unverändert zurück', () => {
    const neu: Probe = { id: '1', name: 'Neu' };
    expect(keepUnknownFields(null, neu)).toBe(neu);
    expect(keepUnknownFields(undefined, neu)).toBe(neu);
  });

  it('erhält Felder, die das Formular nicht kennt', () => {
    // So ging z. B. die Verknüpfung einer bezahlten Rechnung mit ihrer Buchung verloren.
    const original = { id: '1', name: 'Alt', linkedTransactionId: 'tx-7', paidAt: '2026-11-01' } as Probe;
    const result = keepUnknownFields(original, { id: '1', name: 'Geändert' });
    expect(result).toEqual({ id: '1', name: 'Geändert', linkedTransactionId: 'tx-7', paidAt: '2026-11-01' });
  });

  it('lässt Eingaben des Formulars gewinnen, auch geleerte Felder', () => {
    const original: Probe = { id: '1', name: 'Alt', notes: 'alte Notiz' };
    const result = keepUnknownFields(original, { id: '1', name: 'Alt', notes: undefined });
    expect(result.notes).toBeUndefined();
  });

  it('entfernt verwaltete Felder, die das Formular weglässt', () => {
    // Alle Bankfelder geleert: Die Bankverbindung darf nicht aus dem Original zurückkehren.
    const original: Probe = { id: '1', name: 'Alt', bank: { iban: 'DE89370400440532013000' } };
    const result = keepUnknownFields(original, { id: '1', name: 'Alt' }, { managedKeys: ['bank'] });
    expect('bank' in result).toBe(false);
  });

  it('lässt ohne die Angabe managedKeys ein weggelassenes Feld bestehen', () => {
    const original: Probe = { id: '1', name: 'Alt', bank: { iban: 'DE89370400440532013000' } };
    const result = keepUnknownFields(original, { id: '1', name: 'Alt' });
    expect(result.bank).toEqual({ iban: 'DE89370400440532013000' });
  });

  it('erhält unbekannte Unterfelder in genannten Unterobjekten', () => {
    const original = {
      id: '1',
      name: 'Alt',
      address: { city: 'Altstadt', addressSupplement: 'Hinterhaus' }
    } as Probe;
    const result = keepUnknownFields(
      original,
      { id: '1', name: 'Alt', address: { city: 'Neustadt' } },
      { nestedKeys: ['address'] }
    );
    expect(result.address).toEqual({ city: 'Neustadt', addressSupplement: 'Hinterhaus' });
  });

  it('ersetzt nicht genannte Unterobjekte vollständig', () => {
    const original = { id: '1', name: 'Alt', address: { city: 'Altstadt', extra: 'x' } } as Probe;
    const result = keepUnknownFields(original, { id: '1', name: 'Alt', address: { city: 'Neustadt' } });
    expect(result.address).toEqual({ city: 'Neustadt' });
  });

  it('verändert das Original nicht', () => {
    const original = { id: '1', name: 'Alt', address: { city: 'Altstadt' }, extra: 1 } as Probe;
    const kopie = JSON.parse(JSON.stringify(original));
    keepUnknownFields(original, { id: '1', name: 'Neu', address: { city: 'Neustadt' } }, {
      managedKeys: ['bank'],
      nestedKeys: ['address']
    });
    expect(original).toEqual(kopie);
  });
});
