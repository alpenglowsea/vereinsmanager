import { TaxSphere, TaxSphereInfo, Skr42MainCategory, Skr42SubCategory } from '../types';

export const TAX_SPHERES: Record<TaxSphere, TaxSphereInfo> = {
  ideell: {
    id: 'ideell',
    name: '1. Ideeller Bereich',
    subtitle: 'Satzungsgemäße Kernaktivitäten (steuerfrei)',
    description: 'Umfasst alle Einnahmen und Ausgaben, die direkt der Erfüllung des gemeinnützigen Satzungszwecks dienen und keinen Gegenleistungscharakter haben.',
    color: 'emerald',
    examples: [
      'Mitgliedsbeiträge (SKR 3100)',
      'Aufnahmegebühren (SKR 3120)',
      'Spenden / Zuwendungen (SKR 3200)',
      'Zuschüsse von Verbänden / Kommunen (SKR 3300)',
      'Verwaltungsausgaben (SKR 5200)',
      'Verbandsbeiträge (SKR 5100)'
    ]
  },
  vermoegen: {
    id: 'vermoegen',
    name: '2. Vermögensverwaltung',
    subtitle: 'Nutzung von Vereinsvermögen (ertragssteuerfrei)',
    description: 'Umfasst die verzinsliche oder ertragbringende Anlage von Vereinsvermögen ohne aktiven wirtschaftlichen Betrieb.',
    color: 'blue',
    examples: [
      'Zinserträge aus Festgeld/Tagesgeld (SKR 3500)',
      'Dividenden & Wertpapiererträge (SKR 3520)',
      'Langfristige Vermietung von Vereinsheimen / Wohnungen (SKR 3600)',
      'Pachterträge Gaststätte / Vereinsgelände (SKR 3620)',
      'Instandhaltung vermieteter Immobilien (SKR 5500)'
    ]
  },
  zweckbetrieb: {
    id: 'zweckbetrieb',
    name: '3. Zweckbetrieb',
    subtitle: 'Wirtschaftliche Betätigung zur Zweckerreichung (begünstigt)',
    description: 'Wirtschaftliche Aktivitäten, die unmittelbar dazu dienen, die steuerbegünstigten satzungsmäßigen Zwecke zu verwirklichen (oft ermäßigter Steuersatz 7%).',
    color: 'amber',
    examples: [
      'Eintrittsgelder zu sportlichen Wettkämpfen (SKR 4110)',
      'Kurs- & Teilnahmegebühren / Lehrgänge (SKR 4200)',
      'Startgelder & Meldegelder bei Turnieren (SKR 4120)',
      'Sportbekleidung zum Selbstkostenpreis (SKR 4300)',
      'Übungsleiter- & Ehrenamtspauschalen (SKR 6500)',
      'Sportgeräte & Spielbetriebskosten (SKR 6600)'
    ]
  },
  wirtschaftlich: {
    id: 'wirtschaftlich',
    name: '4. Wirtschaftlicher Geschäftsbetrieb',
    subtitle: 'Voll steuerpflichtiger Bereich (Körperschaft- & Gewerbesteuer)',
    description: 'Wirtschaftliche Tätigkeiten mit Gewinnerzielungsabsicht, die in Konkurrenz zu gewerblichen Anbietern stehen (Freigrenze 45.000 € Einnahmen gem. § 64 Abs. 3 AO).',
    color: 'rose',
    examples: [
      'Bandenwerbung / Trikotsponsoring (SKR 4500)',
      'Vereinsfeste mit Bewirtung Speisen/Getränke (SKR 4610)',
      'Vereinsgaststätte / Kioskbetrieb (SKR 4620)',
      'Merchandising & Fanartikelverkauf (SKR 4700)',
      'Wareneinkauf & Bewirtungskosten (SKR 7100)'
    ]
  }
};

/**
 * Vollständiger Standardkontenrahmen 42 (SKR 42)
 * Speziell für Vereine, Stiftungen und gemeinnützige Körperschaften (Nachfolger des SKR 49)
 * Strukturiert nach Sphäre, Buchungsart (Einnahme/Ausgabe), Hauptkategorie und Nebenkategorie (Konto)
 */
export const SKR42_STRUCTURE: Skr42MainCategory[] = [
  // ==========================================
  // 1. IDEELLER BEREICH - EINNAHMEN (3000-3499)
  // ==========================================
  {
    id: 'HK-3100',
    code: '3100',
    name: 'Echte Mitgliedsbeiträge & Aufnahmegebühren',
    sphere: 'ideell',
    type: 'income',
    subCategories: [
      { code: '3110', name: 'Laufende Mitgliedsbeiträge (Monats-/Jahresbeiträge)', label: '3110 - Laufende Mitgliedsbeiträge', vatRateDefault: 0 },
      { code: '3120', name: 'Aufnahmegebühren neuer Mitglieder', label: '3120 - Aufnahmegebühren', vatRateDefault: 0 },
      { code: '3130', name: 'Umlagen & Sonderbeiträge', label: '3130 - Umlagen & Sonderbeiträge', vatRateDefault: 0 },
      { code: '3140', name: 'Abteilungs- & Spartenbeiträge', label: '3140 - Abteilungsbeiträge', vatRateDefault: 0 },
      { code: '3150', name: 'Fördermitgliedsbeiträge', label: '3150 - Fördermitgliedsbeiträge', vatRateDefault: 0 },
      { code: '3190', name: 'Sonstige Mitgliedsbeiträge', label: '3190 - Sonstige Mitgliedsbeiträge', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-3200',
    code: '3200',
    name: 'Spenden, Schenkungen & Zuwendungen',
    sphere: 'ideell',
    type: 'income',
    subCategories: [
      { code: '3210', name: 'Geldspenden mit Zuwendungsbestätigung', label: '3210 - Geldspenden (steuerbegünstigt)', vatRateDefault: 0 },
      { code: '3220', name: 'Kleinspenden / Spendendose (bis 300 €)', label: '3220 - Kleinspenden ohne Bescheinigung', vatRateDefault: 0 },
      { code: '3230', name: 'Sachspenden (mit Zuwendungsbestätigung)', label: '3230 - Sachspenden', vatRateDefault: 0 },
      { code: '3240', name: 'Aufwandsspenden / Rückspenden', label: '3240 - Aufwandsspenden', vatRateDefault: 0 },
      { code: '3250', name: 'Erbschaften, Vermächtnisse & Nachlässe', label: '3250 - Erbschaften & Nachlässe', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-3300',
    code: '3300',
    name: 'Zuschüsse & öffentliche Förderungen',
    sphere: 'ideell',
    type: 'income',
    subCategories: [
      { code: '3310', name: 'Landessportbund- & Verbandszuschüsse', label: '3310 - Landessportbund-Zuschüsse', vatRateDefault: 0 },
      { code: '3320', name: 'Kommunale Sport- & Vereinsförderung (Stadt/Gemeinde)', label: '3320 - Kommunale Vereinsförderung', vatRateDefault: 0 },
      { code: '3330', name: 'Landes- und Bundesfördermittel', label: '3330 - Landes-/Bundesmittel', vatRateDefault: 0 },
      { code: '3340', name: 'Stiftungszuschüsse & Projektförderungen', label: '3340 - Stiftungsförderung', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-3400',
    code: '3400',
    name: 'Sonstige ideelle Erlöse',
    sphere: 'ideell',
    type: 'income',
    subCategories: [
      { code: '3410', name: 'Bußgelder & gerichtliche Geldauflagen', label: '3410 - Gerichtsauflagen & Bußgelder', vatRateDefault: 0 },
      { code: '3420', name: 'Versicherungsentschädigungen (ideeller Bereich)', label: '3420 - Versicherungsentschädigungen', vatRateDefault: 0 },
      { code: '3490', name: 'Verschiedene ideelle Einnahmen', label: '3490 - Sonstige ideelle Einnahmen', vatRateDefault: 0 }
    ]
  },

  // ==========================================
  // 1. IDEELLER BEREICH - AUSGABEN (5000-5499)
  // ==========================================
  {
    id: 'HK-5100',
    code: '5100',
    name: 'Verbandsabgaben & Pflichtbeiträge',
    sphere: 'ideell',
    type: 'expense',
    subCategories: [
      { code: '5110', name: 'Beiträge an Landessportbund / Landesverband', label: '5110 - Beiträge Landessportbund', vatRateDefault: 0 },
      { code: '5120', name: 'Fachverbandsbeiträge & Fachspartenabgaben', label: '5120 - Fachverbandsbeiträge', vatRateDefault: 0 },
      { code: '5130', name: 'Sportversicherungen (ARAG / Sporthilfe / VBG)', label: '5130 - Sportversicherung & VBG', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-5200',
    code: '5200',
    name: 'Allgemeine Verwaltungskosten',
    sphere: 'ideell',
    type: 'expense',
    subCategories: [
      { code: '5210', name: 'Bürobedarf, Drucksachen & Papier', label: '5210 - Bürobedarf & Drucksachen', vatRateDefault: 0 },
      { code: '5220', name: 'Porto, Postgebühren & Frachten', label: '5220 - Porto & Versand', vatRateDefault: 0 },
      { code: '5230', name: 'Telefon, Internet & Vereins-Website', label: '5230 - Telefon, Internet & Webhosting', vatRateDefault: 0 },
      { code: '5240', name: 'Vereinssoftware, IT-Lizenzen & Cloud-Dienste', label: '5240 - Software & IT-Kosten', vatRateDefault: 0 },
      { code: '5250', name: 'Bankgebühren, Kontoführung & Zahlungsverkehr', label: '5250 - Bank- & Kontoführungsgebühren', vatRateDefault: 0 },
      { code: '5260', name: 'Rechts-, Notar- & Steuerberatungskosten (ideell)', label: '5260 - Rechts- & Steuerberatung', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-5300',
    code: '5300',
    name: 'Mitgliederbetreuung & Gremienarbeit',
    sphere: 'ideell',
    type: 'expense',
    subCategories: [
      { code: '5310', name: 'Mitgliederversammlungen & Vorstandssitzungen', label: '5310 - Mitgliederversammlungen', vatRateDefault: 0 },
      { code: '5320', name: 'Mitgliederehrungen, Jubiläen & Präsente', label: '5320 - Ehrungen & Jubiläen', vatRateDefault: 0 },
      { code: '5330', name: 'Vereinsnachrichten, Vereinsheft & Rundschreiben', label: '5330 - Vereinsnachrichten & Infohefte', vatRateDefault: 0 },
      { code: '5340', name: 'Aus- & Weiterbildung ehrenamtlicher Vorstände', label: '5340 - Vorstandsschulungen', vatRateDefault: 0 }
    ]
  },

  // ==========================================
  // 2. VERMÖGENSVERWALTUNG - EINNAHMEN (3500-3999)
  // ==========================================
  {
    id: 'HK-3500',
    code: '3500',
    name: 'Zinsen & Kapitalerträge',
    sphere: 'vermoegen',
    type: 'income',
    subCategories: [
      { code: '3510', name: 'Zinserträge Giro-, Tages- & Festgeld', label: '3510 - Zinsen Giro/Tagesgeld/Festgeld', vatRateDefault: 0 },
      { code: '3520', name: 'Dividenden & Erträge aus Wertpapieren', label: '3520 - Wertpapiererträge & Dividenden', vatRateDefault: 0 },
      { code: '3530', name: 'Zinserträge aus Darlehensgewährung', label: '3530 - Darlehenszinsen', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-3600',
    code: '3600',
    name: 'Vermietung & Verpachtung (langfristig)',
    sphere: 'vermoegen',
    type: 'income',
    subCategories: [
      { code: '3610', name: 'Mieteinnahmen Vereinsheim / Wohnungen / Büros', label: '3610 - Mieteinnahmen Immobilien', vatRateDefault: 0 },
      { code: '3620', name: 'Pachterlöse Vereinsgaststätte / Vereinsgelände', label: '3620 - Pacht Gaststätte & Gelände', vatRateDefault: 0 },
      { code: '3630', name: 'Erbbauzinsen & Nutzungsentgelte', label: '3630 - Erbbauzinsen & Nutzungsentgelte', vatRateDefault: 0 }
    ]
  },

  // ==========================================
  // 2. VERMÖGENSVERWALTUNG - AUSGABEN (5500-5999)
  // ==========================================
  {
    id: 'HK-5500',
    code: '5500',
    name: 'Grundstücks- & Gebäudeaufwand',
    sphere: 'vermoegen',
    type: 'expense',
    subCategories: [
      { code: '5510', name: 'Instandhaltung & Reparaturen vermieteter Objekte', label: '5510 - Instandhaltung vermietete Objekte', vatRateDefault: 0 },
      { code: '5520', name: 'Grundsteuer & Gebäudeversicherungen', label: '5520 - Grundsteuer & Gebäudeversicherungen', vatRateDefault: 0 },
      { code: '5530', name: 'Bewirtschaftungskosten (Heizung, Strom, Wasser Vermietung)', label: '5530 - Bewirtschaftung vermietete Objekte', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-5600',
    code: '5600',
    name: 'Finanz- & Vermögensverwaltungskosten',
    sphere: 'vermoegen',
    type: 'expense',
    subCategories: [
      { code: '5610', name: 'Depot- & Vermögensverwaltungsgebühren', label: '5610 - Depot- & Bankgebühren Vermögen', vatRateDefault: 0 },
      { code: '5620', name: 'Abschreibungen auf Gebäude/Anlagen Vermögensverwaltung', label: '5620 - AfA Gebäude Vermögensverwaltung', vatRateDefault: 0 }
    ]
  },

  // ==========================================
  // 3. ZWECKBETRIEB - EINNAHMEN (4000-4499)
  // ==========================================
  {
    id: 'HK-4100',
    code: '4100',
    name: 'Sportliche & kulturelle Veranstaltungen',
    sphere: 'zweckbetrieb',
    type: 'income',
    subCategories: [
      { code: '4110', name: 'Eintrittsgelder zu Wettkämpfen & Punktspielen', label: '4110 - Eintrittsgelder Spielbetrieb', vatRateDefault: 7 },
      { code: '4120', name: 'Startgelder, Meldegelder & Startpassgebühren', label: '4120 - Start- & Meldegelder', vatRateDefault: 0 },
      { code: '4130', name: 'Turniereinnahmen & Sportfesterlöse (sportlich)', label: '4130 - Sportturniere & Wettkämpfe', vatRateDefault: 7 }
    ]
  },
  {
    id: 'HK-4200',
    code: '4200',
    name: 'Sportbetrieb, Kurse & Lehrgänge',
    sphere: 'zweckbetrieb',
    type: 'income',
    subCategories: [
      { code: '4210', name: 'Kursgebühren (Fitness, Rehasport, Gymnastik, Yoga)', label: '4210 - Kurs- & Kurskartengebühren', vatRateDefault: 0 },
      { code: '4220', name: 'Lehrgangs-, Ausbildungs- & Prüfungsgebühren', label: '4220 - Lehrgangs- & Ausbildungsgebühren', vatRateDefault: 0 },
      { code: '4230', name: 'Trainingslager & Sportfreizeiten (Teilnehmeranteile)', label: '4230 - Trainingslager-Eigenanteile', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-4300',
    code: '4300',
    name: 'Weitergabe von Sportartikeln (Selbstkosten)',
    sphere: 'zweckbetrieb',
    type: 'income',
    subCategories: [
      { code: '4310', name: 'Sportbekleidung & Trikots (Weitergabe an Mitglieder)', label: '4310 - Sportbekleidung Selbstkosten', vatRateDefault: 7 },
      { code: '4320', name: 'Sportgeräte, Bälle & Lehrhefte (Selbstkosten)', label: '4320 - Sportmaterial Selbstkosten', vatRateDefault: 7 }
    ]
  },

  // ==========================================
  // 3. ZWECKBETRIEB - AUSGABEN (6500-6999)
  // ==========================================
  {
    id: 'HK-6500',
    code: '6500',
    name: 'Vergütungen & Traineraufwand',
    sphere: 'zweckbetrieb',
    type: 'expense',
    subCategories: [
      { code: '6510', name: 'Übungsleiterpauschalen (§ 3 Nr. 26 EStG - max. 3.000 €)', label: '6510 - Übungsleiterpauschale (§ 3 Nr. 26 EStG)', vatRateDefault: 0 },
      { code: '6520', name: 'Ehrenamtspauschalen (§ 3 Nr. 26a EStG - max. 840 €)', label: '6520 - Ehrenamtspauschale (§ 3 Nr. 26a EStG)', vatRateDefault: 0 },
      { code: '6530', name: 'Schiedsrichter-, Kampfgericht- & Zeitnehmergelder', label: '6530 - Schiedsrichter- & Kampfgerichtskosten', vatRateDefault: 0 },
      { code: '6540', name: 'Trainervergütungen & Honorare (über Freibetrag)', label: '6540 - Trainerhonorare & Fachkräfte', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-6600',
    code: '6600',
    name: 'Spiel-, Trainings- & Wettkampfbetrieb',
    sphere: 'zweckbetrieb',
    type: 'expense',
    subCategories: [
      { code: '6610', name: 'Sportgeräte, Bälle, Tore, Netze & Trainingsmaterial', label: '6610 - Sport- & Trainingsgeräte', vatRateDefault: 7 },
      { code: '6620', name: 'Mannschaftskleidung, Trikotsätze & Schutzkleidung', label: '6620 - Trikotsätze & Spielkleidung', vatRateDefault: 7 },
      { code: '6630', name: 'Hallen-, Sportplatz- & Bädernutzungsentgelte', label: '6630 - Hallen- & Platzmieten', vatRateDefault: 0 },
      { code: '6640', name: 'Meldegelder & Spielbetriebsabgaben an Fachverbände', label: '6640 - Meldegelder & Spielbetriebsabgaben', vatRateDefault: 0 },
      { code: '6650', name: 'Pokale, Medaillen, Urkunden & Siegerpreise', label: '6650 - Pokale, Medaillen & Urkunden', vatRateDefault: 7 },
      { code: '6660', name: 'Sanitäts-, Erste-Hilfe & Physiotherapiebedarf', label: '6660 - Erste Hilfe & Sportmedizin', vatRateDefault: 7 }
    ]
  },
  {
    id: 'HK-6700',
    code: '6700',
    name: 'Fahrt- & Reisekosten Sportbetrieb',
    sphere: 'zweckbetrieb',
    type: 'expense',
    subCategories: [
      { code: '6710', name: 'Fahrtkosten zu Auswärtsspielen & Wettkämpfen (Bus/PKW)', label: '6710 - Fahrtkosten Auswärtsspiele', vatRateDefault: 0 },
      { code: '6720', name: 'Reisekosten, Übernachtung & Sportlerverpflegung', label: '6720 - Übernachtung & Wettkampfverpflegung', vatRateDefault: 7 }
    ]
  },

  // ==========================================
  // 4. WIRTSCHAFTLICHER GESCHÄFTSBETRIEB - EINNAHMEN (4500-4999)
  // ==========================================
  {
    id: 'HK-4500',
    code: '4500',
    name: 'Werbung, Sponsoring & Marketing',
    sphere: 'wirtschaftlich',
    type: 'income',
    subCategories: [
      { code: '4510', name: 'Bandenwerbung, Hallenwerbung & Zaunwerbung (19%)', label: '4510 - Banden- & Bandenwerbung (19%)', vatRateDefault: 19 },
      { code: '4520', name: 'Trikot- & Materialsponsoring (mit Werbeleistung)', label: '4520 - Trikot- & Materialsponsoring (19%)', vatRateDefault: 19 },
      { code: '4530', name: 'Inserate in Vereinszeitung & Stadionheft', label: '4530 - Inserate Vereinsheft (19%)', vatRateDefault: 19 },
      { code: '4540', name: 'Lautsprecherdurchsagen & Event-Sponsoring', label: '4540 - Event-Sponsoring & Durchsagen', vatRateDefault: 19 }
    ]
  },
  {
    id: 'HK-4600',
    code: '4600',
    name: 'Gastronomie, Kiosk & Bewirtung',
    sphere: 'wirtschaftlich',
    type: 'income',
    subCategories: [
      { code: '4610', name: 'Verkauf Speisen & Getränke (Vereinsfeste / Turniere)', label: '4610 - Verkauf Speisen & Getränke (Feste)', vatRateDefault: 19 },
      { code: '4620', name: 'Kioskbetrieb & Vereinsheim-Eigenbewirtschaftung', label: '4620 - Kioskbetrieb & Vereinsheim', vatRateDefault: 19 }
    ]
  },
  {
    id: 'HK-4700',
    code: '4700',
    name: 'Handel, Merchandising & Sonstiges',
    sphere: 'wirtschaftlich',
    type: 'income',
    subCategories: [
      { code: '4710', name: 'Fanartikel- & Merchandising-Verkauf', label: '4710 - Fanartikel & Merchandise (19%)', vatRateDefault: 19 },
      { code: '4720', name: 'Basare, Tombolas & gewerbliche Veranstaltungen', label: '4720 - Basare, Tombolas & Feste', vatRateDefault: 19 },
      { code: '4730', name: 'Schrott- & Altpapiersammlungen', label: '4730 - Altmaterial- & Schrottsammlungen', vatRateDefault: 19 }
    ]
  },

  // ==========================================
  // 4. WIRTSCHAFTLICHER GESCHÄFTSBETRIEB - AUSGABEN (7000-7999)
  // ==========================================
  {
    id: 'HK-7100',
    code: '7100',
    name: 'Wareneinsatz Wirtschaftlicher Betrieb',
    sphere: 'wirtschaftlich',
    type: 'expense',
    subCategories: [
      { code: '7110', name: 'Wareneinkauf Speisen, Grillgut & Getränke', label: '7110 - Wareneinkauf Speisen & Getränke', vatRateDefault: 19 },
      { code: '7120', name: 'Wareneinkauf Fanartikel, Schals & Merchandise', label: '7120 - Wareneinkauf Fanartikel', vatRateDefault: 19 },
      { code: '7130', name: 'Verpackungs- & Einwegmaterial für Feste', label: '7130 - Verpackungs- & Festbedarf', vatRateDefault: 19 }
    ]
  },
  {
    id: 'HK-7200',
    code: '7200',
    name: 'Veranstaltungs- & Werbeaufwand',
    sphere: 'wirtschaftlich',
    type: 'expense',
    subCategories: [
      { code: '7210', name: 'GEMA-Gebühren für gesellige Festveranstaltungen', label: '7210 - GEMA-Gebühren (gesellige Feste)', vatRateDefault: 0 },
      { code: '7220', name: 'Miete für Festzelte, Eventtechnik & Beschallung', label: '7220 - Miete Festzelte & Eventtechnik', vatRateDefault: 19 },
      { code: '7230', name: 'Sponsorenakquise, Werbemittel & Grafikerstellung', label: '7230 - Werbeaufwand & Sponsorenpflege', vatRateDefault: 19 }
    ]
  },
  {
    id: 'HK-7300',
    code: '7300',
    name: 'Steuern Wirtschaftlicher Geschäftsbetrieb',
    sphere: 'wirtschaftlich',
    type: 'expense',
    subCategories: [
      { code: '7310', name: 'Umsatzsteuerzahllast an das Finanzamt', label: '7310 - Umsatzsteuerzahllast', vatRateDefault: 0 },
      { code: '7320', name: 'Körperschaftsteuer & Solidaritätszuschlag', label: '7320 - Körperschaftsteuer', vatRateDefault: 0 },
      { code: '7330', name: 'Gewerbesteuer an die Stadt/Gemeinde', label: '7330 - Gewerbesteuer', vatRateDefault: 0 }
    ]
  }
];

// Helper functions for SKR 42
export const getSkr42MainCategories = (sphere: TaxSphere, type: 'income' | 'expense'): Skr42MainCategory[] => {
  return SKR42_STRUCTURE.filter(m => m.sphere === sphere && m.type === type);
};

export const getSkr42SubCategories = (
  sphere: TaxSphere,
  type: 'income' | 'expense',
  mainCategoryId?: string
): Skr42SubCategory[] => {
  const mains = getSkr42MainCategories(sphere, type);
  if (mainCategoryId) {
    const found = mains.find(m => m.id === mainCategoryId || m.code === mainCategoryId || m.name === mainCategoryId);
    if (found) return found.subCategories;
  }
  // Return all subcategories for this sphere and type
  return mains.flatMap(m => m.subCategories);
};

/**
 * Finds matching SKR42 main category from a subcategory name or code
 */
export const findSkr42MainForSub = (subNameOrCode: string): Skr42MainCategory | undefined => {
  return SKR42_STRUCTURE.find(main =>
    main.subCategories.some(
      sub =>
        sub.label === subNameOrCode ||
        sub.name === subNameOrCode ||
        sub.code === subNameOrCode ||
        subNameOrCode.includes(sub.code) ||
        subNameOrCode.includes(sub.name)
    )
  );
};

/**
 * Legacy compatibility: Flat category lists per sphere
 */
export const SPHERE_CATEGORIES: Record<TaxSphere, { income: string[]; expense: string[] }> = {
  ideell: {
    income: SKR42_STRUCTURE.filter(m => m.sphere === 'ideell' && m.type === 'income').flatMap(m => m.subCategories.map(s => s.label)),
    expense: SKR42_STRUCTURE.filter(m => m.sphere === 'ideell' && m.type === 'expense').flatMap(m => m.subCategories.map(s => s.label))
  },
  vermoegen: {
    income: SKR42_STRUCTURE.filter(m => m.sphere === 'vermoegen' && m.type === 'income').flatMap(m => m.subCategories.map(s => s.label)),
    expense: SKR42_STRUCTURE.filter(m => m.sphere === 'vermoegen' && m.type === 'expense').flatMap(m => m.subCategories.map(s => s.label))
  },
  zweckbetrieb: {
    income: SKR42_STRUCTURE.filter(m => m.sphere === 'zweckbetrieb' && m.type === 'income').flatMap(m => m.subCategories.map(s => s.label)),
    expense: SKR42_STRUCTURE.filter(m => m.sphere === 'zweckbetrieb' && m.type === 'expense').flatMap(m => m.subCategories.map(s => s.label))
  },
  wirtschaftlich: {
    income: SKR42_STRUCTURE.filter(m => m.sphere === 'wirtschaftlich' && m.type === 'income').flatMap(m => m.subCategories.map(s => s.label)),
    expense: SKR42_STRUCTURE.filter(m => m.sphere === 'wirtschaftlich' && m.type === 'expense').flatMap(m => m.subCategories.map(s => s.label))
  }
};

export const DEFAULT_DEPARTMENTS = [
  'Fußball',
  'Tennis',
  'Leichtathletik',
  'Turnen & Gymnastik',
  'Tischtennis',
  'Schach',
  'Volleyball',
  'Schwimmen',
  'Vorstand & Verwaltung',
  'Ehrenmitglieder'
];
