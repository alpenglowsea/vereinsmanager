import { ClubContact } from '../types';

export const INITIAL_CONTACTS: ClubContact[] = [
  {
    id: 'cnt-1',
    contactNumber: 'K-1001',
    personType: 'legal',
    types: ['sponsor', 'donor'],
    companyName: 'Musterstadt Stadtwerke AG',
    legalForm: 'AG',
    displayName: 'Musterstadt Stadtwerke AG',
    contactPerson: {
      salutation: 'Herr',
      firstName: 'Klaus',
      lastName: 'Bergmann',
      roleOrPosition: 'Leitung Marketing & Sponsoring',
      email: 'klaus.bergmann@stadtwerke-musterstadt.de',
      phone: '01234 9876-140'
    },
    taxId: '112/5840/0199',
    commercialRegister: 'HRB 4810 (Amtsgericht Musterstadt)',
    address: {
      street: 'Energiestraße',
      houseNumber: '1',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    email: 'info@stadtwerke-musterstadt.de',
    phone: '01234 9876-0',
    website: 'https://www.stadtwerke-musterstadt.de',
    bankDetails: {
      iban: 'DE12370501980000112233',
      bic: 'SPKDMUSTXXX',
      bankName: 'Sparkasse Musterstadt',
      accountHolder: 'Musterstadt Stadtwerke AG'
    },
    creditorOrDebtorNumber: 'DEB-10001',
    notes: 'Hauptsponsor der Jugendabteilung und Partner beim jährlichen Hallenturnier. Sponsoringvertrag läuft bis 2027.',
    tags: ['Hauptsponsor', 'Jugendförderung', 'Stadtwerke'],
    createdAt: '2024-01-10T10:00:00.000Z',
    updatedAt: '2025-01-20T14:30:00.000Z'
  },
  {
    id: 'cnt-2',
    contactNumber: 'K-1002',
    personType: 'legal',
    types: ['sponsor'],
    companyName: 'Autohaus Müller GmbH',
    legalForm: 'GmbH',
    displayName: 'Autohaus Müller GmbH',
    contactPerson: {
      salutation: 'Herr',
      firstName: 'Thomas',
      lastName: 'Müller',
      roleOrPosition: 'Geschäftsführer',
      email: 't.mueller@autohaus-mueller-musterstadt.de',
      phone: '01234 4567-11'
    },
    taxId: '112/5841/4491',
    commercialRegister: 'HRB 6219 (Amtsgericht Musterstadt)',
    address: {
      street: 'Industriestraße',
      houseNumber: '44',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    email: 'kontakt@autohaus-mueller-musterstadt.de',
    phone: '01234 4567-0',
    website: 'https://www.autohaus-mueller-musterstadt.de',
    bankDetails: {
      iban: 'DE55370501981122446688',
      bic: 'SPKDMUSTXXX',
      bankName: 'Sparkasse Musterstadt',
      accountHolder: 'Autohaus Müller GmbH'
    },
    creditorOrDebtorNumber: 'DEB-10002',
    notes: 'Bandenwerbung am Hauptplatz und Fuhrpark-Sponsor für Jugendfahrten.',
    tags: ['Bandenwerbung', 'Sponsor'],
    createdAt: '2024-02-15T09:00:00.000Z',
    updatedAt: '2025-02-20T11:45:00.000Z'
  },
  {
    id: 'cnt-3',
    contactNumber: 'K-1003',
    personType: 'legal',
    types: ['supplier'],
    companyName: 'Metro Großmarkt Musterstadt',
    legalForm: 'GmbH & Co. KG',
    displayName: 'Metro Großmarkt Musterstadt',
    contactPerson: {
      salutation: 'Frau',
      firstName: 'Sabine',
      lastName: 'Wegner',
      roleOrPosition: 'Großkundenbetreuung Vereine',
      email: 'vereine@metro-musterstadt.de',
      phone: '01234 8820-22'
    },
    taxId: 'DE811122334',
    address: {
      street: 'Großmarktring',
      houseNumber: '10',
      zip: '12349',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    email: 'kundenservice@metro-musterstadt.de',
    phone: '01234 8820-0',
    website: 'https://www.metro.de',
    bankDetails: {
      iban: 'DE89100500001099887766',
      bic: 'BELADE100',
      bankName: 'Berliner Bank',
      accountHolder: 'Metro Cash & Carry Deutschland GmbH'
    },
    creditorOrDebtorNumber: 'KRED-70001',
    notes: 'Kundenkarte TSV Musterstadt #84920. Rabattvereinbarung auf Getränke und Grillgut für Vereinsfeste.',
    tags: ['Lieferant', 'Kiosk', 'Getränke'],
    createdAt: '2024-03-01T12:00:00.000Z',
    updatedAt: '2025-02-11T10:00:00.000Z'
  },
  {
    id: 'cnt-4',
    contactNumber: 'K-1004',
    personType: 'legal',
    types: ['association', 'authority'],
    companyName: 'Landessportbund NRW e.V.',
    legalForm: 'e.V.',
    displayName: 'Landessportbund NRW e.V.',
    contactPerson: {
      salutation: 'Frau',
      firstName: 'Dr. Elke',
      lastName: 'Schneider',
      roleOrPosition: 'Vereinsberatung & Sportversicherung',
      email: 'beratung@lsb.nrw',
      phone: '0203 7381-600'
    },
    address: {
      street: 'Friedrich-Alfred-Straße',
      houseNumber: '25',
      zip: '47055',
      city: 'Duisburg',
      country: 'Deutschland'
    },
    email: 'info@lsb.nrw',
    phone: '0203 7381-0',
    website: 'https://www.lsb.nrw',
    bankDetails: {
      iban: 'DE33350500000001234567',
      bic: 'WELFDE33XXX',
      bankName: 'Stadtsparkasse Duisburg',
      accountHolder: 'Landessportbund NRW e.V.'
    },
    creditorOrDebtorNumber: 'KRED-70002',
    notes: 'Dachverband. ARAG Sportversicherung, Übungsleiter-Zuschüsse und Bestandserhebung jährlich bis 31.01.',
    tags: ['Dachverband', 'Sportbund', 'Versicherung'],
    createdAt: '2023-01-01T08:00:00.000Z',
    updatedAt: '2025-01-25T09:15:00.000Z'
  },
  {
    id: 'cnt-5',
    contactNumber: 'K-1005',
    personType: 'legal',
    types: ['supplier', 'service'],
    companyName: 'Sportshop Franke',
    legalForm: 'Einzelunternehmen',
    displayName: 'Sportshop Franke',
    contactPerson: {
      salutation: 'Herr',
      firstName: 'Jürgen',
      lastName: 'Franke',
      roleOrPosition: 'Inhaber',
      email: 'j.franke@sportshop-franke.de',
      phone: '01234 554433'
    },
    address: {
      street: 'Marktplatz',
      houseNumber: '7',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    email: 'service@sportshop-franke.de',
    phone: '01234 554430',
    website: 'https://www.sportshop-franke.de',
    bankDetails: {
      iban: 'DE77370501980099887766',
      bic: 'SPKDMUSTXXX',
      bankName: 'Sparkasse Musterstadt',
      accountHolder: 'Jürgen Franke Sportartikel'
    },
    creditorOrDebtorNumber: 'KRED-70003',
    notes: 'Ausrüster der Fußball- und Tennissparte. 20% Vereinsrabatt auf Bälle und Trikotsätze mit Vereinsflock.',
    tags: ['Sportartikel', 'Trikots', 'Lieferant'],
    createdAt: '2024-04-10T11:00:00.000Z',
    updatedAt: '2025-03-01T10:00:00.000Z'
  },
  {
    id: 'cnt-6',
    contactNumber: 'K-1006',
    personType: 'natural',
    types: ['donor', 'sponsor'],
    salutation: 'Dr.',
    firstName: 'Martin',
    lastName: 'Lindner',
    displayName: 'Dr. Martin Lindner',
    address: {
      street: 'Buchenweg',
      houseNumber: '14',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    email: 'm.lindner@praxis-lindner.de',
    phone: '01234 332211',
    mobile: '0171 9988112',
    notes: 'Langjähriger Förderer der Turn- und Leichtathletikabteilung. Jährliche Spende für Sportgeräte.',
    tags: ['Großspender', 'Förderkreis'],
    createdAt: '2024-05-12T14:00:00.000Z',
    updatedAt: '2025-01-10T09:00:00.000Z'
  },
  {
    id: 'cnt-7',
    contactNumber: 'K-1007',
    personType: 'legal',
    types: ['authority', 'partner'],
    companyName: 'Stadtverwaltung Musterstadt (Fachbereich Sport)',
    legalForm: 'Körperschaft d.ö.R.',
    displayName: 'Stadtverwaltung Musterstadt (Fachbereich Sport)',
    contactPerson: {
      salutation: 'Frau',
      firstName: 'Heike',
      lastName: 'Sommer',
      roleOrPosition: 'Sachgebietsleitung Sportstätten & Hallenbelegung',
      email: 'heike.sommer@musterstadt.de',
      phone: '01234 100-340'
    },
    address: {
      street: 'Rathausplatz',
      houseNumber: '1',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    email: 'sportamt@musterstadt.de',
    phone: '01234 100-0',
    website: 'https://www.musterstadt.de/sport',
    notes: 'Zuständig für Hallenbelegungspläne städtischer Turnhallen, Sportförderung und Sportlerehrungen.',
    tags: ['Kommune', 'Sportamt', 'Hallenvergabe'],
    createdAt: '2023-05-01T08:00:00.000Z',
    updatedAt: '2024-10-15T11:00:00.000Z'
  }
];
