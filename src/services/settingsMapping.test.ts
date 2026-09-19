import { describe, it, expect } from 'vitest';
import { ClubSettings } from '../types';
import { mapSettingsToDb, mapSettingsFromDb, SPALTEN } from './settingsMapping';

/**
 * Vollstaendig ausgefuellte Vereinsstammdaten. Jedes Feld traegt einen
 * unverwechselbaren Wert, damit ein vertauschtes oder verlorenes Feld sofort
 * auffaellt.
 */
const VOLLSTAENDIG: ClubSettings = {
  clubName: 'TSV Musterstadt 1890 e.V.',
  clubLogoUrl: 'data:image/png;base64,AAAA',
  associationNumber: 'VR 48219',
  taxNumber: '112/5840/1922',
  creditorId: 'DE98ZZZ09999999999',
  creditorIban: 'DE89370501981122334455',
  creditorBic: 'SPKDMUSTXXX',
  creditorAccountId: 'acc-1',
  address: {
    street: 'Sportplatzweg',
    houseNumber: '12',
    zip: '12345',
    city: 'Musterstadt',
    country: 'Deutschland'
  },
  clubAddress: {
    street: 'Sportplatzweg',
    houseNumber: '12',
    zip: '12345',
    city: 'Musterstadt',
    country: 'Deutschland'
  },
  chairman: 'Dr. Michael Sommer',
  treasurer: 'Sabine Weber',
  boardMembers: [{ id: 'bm-1', role: '1. Vorsitzender', name: 'Dr. Michael Sommer' }],
  email: 'vorstand@tsv-musterstadt1890.de',
  phone: '01234 567890',
  website: 'https://tsv-musterstadt1890.de',
  departments: ['Fussball', 'Tennis'],
  currency: 'EUR',
  dateFormat: 'dd.MM.yyyy',
  fiscalYearStart: '01-01',
  taxOffice: 'Finanzamt Musterstadt',
  taxExemptionDate: '10.01.2024',
  taxAssessmentPeriod: '2021 bis 2023',
  promotedPurposes: 'Foerderung des Sports',
  geminiApiKey: 'gemini-schluessel',
  aiProvider: 'anthropic',
  aiApiKey: 'ki-schluessel',
  aiModel: 'claude-3-5-haiku-20241022',
  aiBaseUrl: 'http://localhost:11434/v1'
};

describe('Vereinsstammdaten: Zuordnung zu Supabase', () => {
  it('bringt jedes Feld unbeschadet hin und zurueck', () => {
    // Der eigentliche Zweck dieser Datei. Genau hier ging bisher die Haelfte
    // der Vereinsstammdaten verloren.
    const zurueck = mapSettingsFromDb(mapSettingsToDb(VOLLSTAENDIG));
    expect(zurueck).toEqual(VOLLSTAENDIG);
  });

  it('deckt jedes Feld der Vereinsstammdaten ab', () => {
    // Doppelter Boden zur Typpruefung: Waere ein Feld nur zufaellig gleich
    // benannt, faellt es hier auf.
    for (const feld of Object.keys(VOLLSTAENDIG)) {
      expect(SPALTEN).toHaveProperty(feld);
    }
  });

  it('laesst das Erscheinungsbild bewusst aus', () => {
    // Hell oder dunkel gehoert zum Geraet. Landete es in der Cloud, zwaenge
    // ein Vorstandsmitglied allen anderen seine Ansicht auf.
    const zeile = mapSettingsToDb({ ...VOLLSTAENDIG, theme: 'dark' });
    expect(JSON.stringify(zeile)).not.toContain('dark');
    expect(mapSettingsFromDb(zeile)).not.toHaveProperty('theme');
  });

  it('schreibt geleerte Angaben als null statt sie wegzulassen', () => {
    // PostgREST aendert beim Speichern nur die mitgeschickten Spalten. Fehlte
    // das Feld, behielte die Datenbank den alten Wert: Eine geloeschte Angabe
    // kaeme beim naechsten Laden zurueck.
    const ohneLogo = { ...VOLLSTAENDIG };
    delete ohneLogo.clubLogoUrl;

    const zeile = mapSettingsToDb(ohneLogo);
    // Die Spalte ist da und traegt null — nicht etwa gar nicht vorhanden.
    expect(Object.prototype.hasOwnProperty.call(zeile, SPALTEN.clubLogoUrl)).toBe(true);
    expect(zeile[SPALTEN.clubLogoUrl]).toBeNull();
    // Unter dem Namen aus der App steht dort nichts.
    expect(Object.prototype.hasOwnProperty.call(zeile, 'clubLogoUrl')).toBe(false);
  });

  it('macht aus null in der Datenbank ein fehlendes Feld, kein "null"', () => {
    // Sonst stuende in den Eingabefeldern der Oberflaeche woertlich "null".
    const zeile = mapSettingsToDb(VOLLSTAENDIG);
    zeile[SPALTEN.website] = null;
    zeile[SPALTEN.clubLogoUrl] = null;

    const zurueck = mapSettingsFromDb(zeile);
    expect(zurueck.website).toBeUndefined();
    expect(zurueck.clubLogoUrl).toBeUndefined();
  });

  it('liefert fuer eine leere Zeile brauchbare Pflichtfelder', () => {
    const zurueck = mapSettingsFromDb({});
    expect(zurueck.clubName).toBe('');
    expect(zurueck.departments).toEqual([]);
    expect(zurueck.address).toBe('');
  });

  it('nimmt die Anschrift als Text genauso wie als Objekt', () => {
    // ClubSettings.address ist beides erlaubt; die Spalte ist deshalb JSONB.
    const alsText = mapSettingsFromDb(mapSettingsToDb({ ...VOLLSTAENDIG, address: 'Sportplatzweg 12' }));
    expect(alsText.address).toBe('Sportplatzweg 12');

    const alsObjekt = mapSettingsFromDb(mapSettingsToDb(VOLLSTAENDIG));
    expect(alsObjekt.address).toEqual(VOLLSTAENDIG.address);
  });

  it('haelt Vorstandsliste und Abteilungen als Listen zusammen', () => {
    const zurueck = mapSettingsFromDb(mapSettingsToDb(VOLLSTAENDIG));
    expect(zurueck.boardMembers).toHaveLength(1);
    expect(zurueck.boardMembers?.[0].name).toBe('Dr. Michael Sommer');
    expect(zurueck.departments).toEqual(['Fussball', 'Tennis']);
  });
});
