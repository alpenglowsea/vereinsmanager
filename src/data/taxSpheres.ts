import { TaxSphere, TaxSphereInfo, Skr42MainCategory, Skr42SubCategory } from '../types';

export const TAX_SPHERES: Record<TaxSphere, TaxSphereInfo> = {
  ideell: {
    id: 'ideell',
    name: '1. Ideeller Bereich',
    subtitle: 'Satzungsgemäße Kernaktivitäten (steuerfrei)',
    description: 'Umfasst alle Einnahmen und Ausgaben, die direkt der Erfüllung des gemeinnützigen Satzungszwecks dienen und keinen Gegenleistungscharakter haben.',
    color: 'emerald',
    examples: [
      'Mitgliedsbeiträge (Konto 40000)',
      'Aufnahmegebühren (Konto 40010)',
      'Spenden / Zuwendungen (Konto 40400 / 40450)',
      'Zuschüsse von Kommunen & Verbänden (Konto 40700)',
      'Verwaltungsausgaben & Verbandsbeiträge (Konto 66100 / 68000)'
    ]
  },
  vermoegen: {
    id: 'vermoegen',
    name: '2. Vermögensverwaltung',
    subtitle: 'Nutzung von Vereinsvermögen (ertragssteuerfrei)',
    description: 'Umfasst die verzinsliche oder ertragbringende Anlage von Vereinsvermögen ohne aktiven wirtschaftlichen Betrieb.',
    color: 'blue',
    examples: [
      'Zinserträge aus Festgeld/Tagesgeld (Konto 47000)',
      'Dividenden & Wertpapiererträge (Konto 47200)',
      'Langfristige Vermietung von Vereinsheim / Gaststätte (Konto 46100)',
      'Pachterträge Sportgelände (Konto 46200)',
      'Instandhaltung vermieteter Immobilien (Konto 62150)'
    ]
  },
  zweckbetrieb: {
    id: 'zweckbetrieb',
    name: '3. Zweckbetrieb',
    subtitle: 'Wirtschaftliche Betätigung zur Zweckerreichung (begünstigt)',
    description: 'Wirtschaftliche Aktivitäten, die unmittelbar dazu dienen, die steuerbegünstigten satzungsmäßigen Zwecke zu verwirklichen (oft ermäßigter Steuersatz 7%).',
    color: 'amber',
    examples: [
      'Eintrittsgelder zu sportlichen Wettkämpfen (Konto 41100)',
      'Kurs- & Lehrgangsgebühren (Konto 41200)',
      'Start- und Meldegelder bei Turnieren (Konto 41300)',
      'Sportkleidung zum Selbstkostenpreis (Konto 41400)',
      'Übungsleiterpauschalen gem. § 3 Nr. 26 EStG (Konto 60040)',
      'Sportgeräte, Spielbetrieb & Hallenmieten (Konto 62100 / 65100)'
    ]
  },
  wirtschaftlich: {
    id: 'wirtschaftlich',
    name: '4. Wirtschaftlicher Geschäftsbetrieb',
    subtitle: 'Voll steuerpflichtiger Bereich (Körperschaft- & Gewerbesteuer)',
    description: 'Wirtschaftliche Tätigkeiten mit Gewinnerzielungsabsicht, die in Konkurrenz zu gewerblichen Anbietern stehen (Freigrenze 45.000 € Einnahmen gem. § 64 Abs. 3 AO).',
    color: 'rose',
    examples: [
      'Bandenwerbung / Trikotsponsoring (Konto 44100 / 44200)',
      'Vereinsgaststätte / Kantine / Kioskbetrieb (Konto 43100)',
      'Vereinsfeste mit Bewirtung Speisen & Getränke (Konto 43200)',
      'Merchandising & Fanartikelverkauf (Konto 45100)',
      'Wareneinkauf Speisen & Getränke (Konto 51000 / 51100)'
    ]
  }
};

/**
 * Offizieller DATEV Standardkontenrahmen 42 (SKR 42)
 * Speziell für Vereine, Stiftungen und gemeinnützige Körperschaften
 * 5-stellige Kontonummern nach SKR 04-Systematik mit Zuordnung zu den 4 steuerlichen Sphären (KOST 1)
 */
export const SKR42_STRUCTURE: Skr42MainCategory[] = [
  // =========================================================================
  // 1. IDEELLER BEREICH - EINNAHMEN (Klasse 4)
  // =========================================================================
  {
    id: 'HK-40000',
    code: '40000',
    name: 'Mitgliedsbeiträge & Aufnahmegebühren',
    sphere: 'ideell',
    type: 'income',
    subCategories: [
      { code: '40000', name: 'Echte Mitgliedsbeiträge (laufend)', label: '40000 - Echte Mitgliedsbeiträge (laufend)', vatRateDefault: 0 },
      { code: '40001', name: 'Mitgliedsbeiträge Kinder / Jugend (Junioren)', label: '40001 - Mitgliedsbeiträge Kinder & Jugend', vatRateDefault: 0 },
      { code: '40002', name: 'Mitgliedsbeiträge Erwachsene (Aktiv)', label: '40002 - Mitgliedsbeiträge Erwachsene (Aktiv)', vatRateDefault: 0 },
      { code: '40003', name: 'Mitgliedsbeiträge Senioren', label: '40003 - Mitgliedsbeiträge Senioren', vatRateDefault: 0 },
      { code: '40004', name: 'Mitgliedsbeiträge Familien & Partnertarife', label: '40004 - Familien- & Partnertarife', vatRateDefault: 0 },
      { code: '40005', name: 'Mitgliedsbeiträge Passive Mitglieder', label: '40005 - Passive Mitgliedsbeiträge', vatRateDefault: 0 },
      { code: '40006', name: 'Fördermitgliedsbeiträge', label: '40006 - Fördermitgliedsbeiträge', vatRateDefault: 0 },
      { code: '40010', name: 'Aufnahmegebühren neuer Mitglieder', label: '40010 - Aufnahmegebühren', vatRateDefault: 0 },
      { code: '40020', name: 'Umlagen & satzungsgemäße Sonderbeiträge', label: '40020 - Umlagen & Sonderbeiträge', vatRateDefault: 0 },
      { code: '40030', name: 'Abteilungs- & Spartenbeiträge', label: '40030 - Abteilungs- & Spartenbeiträge', vatRateDefault: 0 },
      { code: '40090', name: 'Sonstige Mitgliedsbeiträge', label: '40090 - Sonstige Mitgliedsbeiträge', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-40400',
    code: '40400',
    name: 'Spenden, Schenkungen & Zuwendungen',
    sphere: 'ideell',
    type: 'income',
    subCategories: [
      { code: '40400', name: 'Spenden & Zuwendungen allgemein', label: '40400 - Spenden & Zuwendungen allgemein', vatRateDefault: 0 },
      { code: '40450', name: 'Geldspenden mit Zuwendungsbestätigung (§ 10b EStG)', label: '40450 - Geldspenden (mit Zuwendungsbestätigung)', vatRateDefault: 0 },
      { code: '40460', name: 'Kleinspenden ohne Bescheinigung / Spendendose (bis 300 €)', label: '40460 - Kleinspenden / Spendendose (bis 300 €)', vatRateDefault: 0 },
      { code: '40550', name: 'Sachspenden (mit Zuwendungsbestätigung)', label: '40550 - Sachspenden (mit Bescheinigung)', vatRateDefault: 0 },
      { code: '40560', name: 'Aufwandsspenden / Rückspenden', label: '40560 - Aufwandsspenden / Rückspenden', vatRateDefault: 0 },
      { code: '40600', name: 'Erbschaften, Vermächtnisse & Nachlässe', label: '40600 - Erbschaften & Vermächtnisse', vatRateDefault: 0 },
      { code: '40650', name: 'Zuwendungen & Zuwendungszuschüsse ohne Werbegegenleistung', label: '40650 - Zuwendungen ohne Gegenleistung', vatRateDefault: 0 },
      { code: '40690', name: 'Sonstige Schenkungen & Zuwendungen', label: '40690 - Sonstige Zuwendungen', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-40700',
    code: '40700',
    name: 'Zuschüsse & öffentliche Förderungen',
    sphere: 'ideell',
    type: 'income',
    subCategories: [
      { code: '40700', name: 'Öffentliche Zuschüsse & Beihilfen allgemein', label: '40700 - Öffentliche Zuschüsse allgemein', vatRateDefault: 0 },
      { code: '40710', name: 'Zuschüsse Landessportbund & Landesfachverbände', label: '40710 - Landessportbund-Zuschüsse', vatRateDefault: 0 },
      { code: '40720', name: 'Kommunale Sportförderung (Stadt, Gemeinde, Landkreis)', label: '40720 - Kommunale Sportförderung', vatRateDefault: 0 },
      { code: '40730', name: 'Landes- und Bundesfördermittel (Ministerien)', label: '40730 - Landes- & Bundesfördermittel', vatRateDefault: 0 },
      { code: '40740', name: 'Stiftungszuschüsse & Drittmittel', label: '40740 - Stiftungszuschüsse & Drittmittel', vatRateDefault: 0 },
      { code: '40750', name: 'Investitionszuschüsse & Baubeihilfen (ideeller Bereich)', label: '40750 - Investitionszuschüsse ideell', vatRateDefault: 0 },
      { code: '40760', name: 'Zuschüsse für Kinder- & Jugendarbeit', label: '40760 - Kinder- & Jugendförderung', vatRateDefault: 0 },
      { code: '40790', name: 'Sonstige Förderungen & Zuwendungen', label: '40790 - Sonstige Zuschüsse', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-40800',
    code: '40800',
    name: 'Sonstige ideelle Erlöse & Bußgelder',
    sphere: 'ideell',
    type: 'income',
    subCategories: [
      { code: '40800', name: 'Bußgelder & gerichtliche Geldauflagen', label: '40800 - Gerichtsauflagen & Bußgelder', vatRateDefault: 0 },
      { code: '40810', name: 'Versicherungsentschädigungen (ideeller Bereich)', label: '40810 - Versicherungsentschädigungen', vatRateDefault: 0 },
      { code: '40820', name: 'Kostenerstattungen & Umlagen (ideell)', label: '40820 - Kostenerstattungen ideell', vatRateDefault: 0 },
      { code: '40830', name: 'Auflösung zweckgebundener Rücklagen gem. § 62 AO', label: '40830 - Auflösung von Rücklagen (§ 62 AO)', vatRateDefault: 0 },
      { code: '40890', name: 'Verschiedene ideelle Einnahmen', label: '40890 - Verschiedene ideelle Einnahmen', vatRateDefault: 0 }
    ]
  },

  // =========================================================================
  // 1. IDEELLER BEREICH - AUSGABEN (Klasse 5 & 6)
  // =========================================================================
  {
    id: 'HK-50000-IDE',
    code: '50000',
    name: 'Satzungsmäßige Förderungen & Zuwendungen',
    sphere: 'ideell',
    type: 'expense',
    subCategories: [
      { code: '50010', name: 'Mittelweiterleitung an steuerbegünstigte Körperschaften (§ 58 Nr. 1 AO)', label: '50010 - Mittelweiterleitung gem. § 58 Nr. 1 AO', vatRateDefault: 0 },
      { code: '50020', name: 'Preise, Stipendien & Ehrenpreise (Satzungszwecke)', label: '50020 - Satzungsmäßige Preise & Förderungen', vatRateDefault: 0 },
      { code: '50030', name: 'Zuwendungen an bedürftige Personen (§ 53 AO)', label: '50030 - Unterstützung Hilfsbedürftiger (§ 53 AO)', vatRateDefault: 0 },
      { code: '50090', name: 'Sonstige satzungsmäßige Zuwendungen', label: '50090 - Sonstige Zuwendungen Satzungszweck', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-68000-IDE',
    code: '68000',
    name: 'Verwaltung, Verband & ideeller Aufwand',
    sphere: 'ideell',
    type: 'expense',
    subCategories: [
      { code: '66100', name: 'Beiträge an Fachverbände & Landessportbund', label: '66100 - Verbandsabgaben & LSB-Beiträge', vatRateDefault: 0 },
      { code: '68100', name: 'Büromaterial, Papier & Druckkosten', label: '68100 - Büromaterial & Druckkosten', vatRateDefault: 0 },
      { code: '68200', name: 'Porto, Postgebühren & Versandkosten', label: '68200 - Porto & Versandkosten', vatRateDefault: 0 },
      { code: '68300', name: 'Telefon, Internet & Vereinskommunikation', label: '68300 - Telefon & Internet', vatRateDefault: 0 },
      { code: '68400', name: 'Softwarelizenzen, Vereinssoftware & Cloud-Dienste', label: '68400 - Vereinssoftware & IT-Lizenzen', vatRateDefault: 0 },
      { code: '68500', name: 'Bankgebühren, Kontoführung & Zahlungsverkehr', label: '68500 - Bankgebühren & Zahlungsverkehr', vatRateDefault: 0 },
      { code: '68600', name: 'Rechts- und Steuerberatung, Buchführung, Abschlussprüfung', label: '68600 - Steuer- & Rechtsberatung, Buchhaltung', vatRateDefault: 0 },
      { code: '68700', name: 'Mitgliederversammlung, Vorstandssitzungen & Gremien', label: '68700 - Hauptversammlung & Vorstandssitzungen', vatRateDefault: 0 },
      { code: '68800', name: 'Vereinshaftpflicht- & Vermögensschadenversicherung', label: '68800 - Vereinsversicherungen & Haftpflicht', vatRateDefault: 0 },
      { code: '68900', name: 'Fortbildung & Schulungen (Vorstand & Ehrenamt)', label: '68900 - Fortbildung Vorstand & Funktionäre', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-69000-IDE',
    code: '69000',
    name: 'Abschreibungen ideeller Bereich',
    sphere: 'ideell',
    type: 'expense',
    subCategories: [
      { code: '69010', name: 'Abschreibungen auf Software & immaterielle Werte (ideell)', label: '69010 - AfA Software / immaterielle Werte', vatRateDefault: 0 },
      { code: '69020', name: 'Abschreibungen auf Sachanlagen (ideeller Bereich)', label: '69020 - AfA Sachanlagen ideeller Bereich', vatRateDefault: 0 },
      { code: '69200', name: 'Sofortabschreibung geringwertiger Wirtschaftsgüter (GWG bis 800 € / 1.000 €)', label: '69200 - GWG-Sofortabschreibung ideell', vatRateDefault: 0 }
    ]
  },

  // =========================================================================
  // 2. VERMÖGENSVERWALTUNG - EINNAHMEN (Klasse 4)
  // =========================================================================
  {
    id: 'HK-46000',
    code: '46000',
    name: 'Mieten, Pachten & Immobilienerträge',
    sphere: 'vermoegen',
    type: 'income',
    subCategories: [
      { code: '46100', name: 'Mieteinnahmen & Pachten Vereinsheim / Vereinsgaststätte (langfristig)', label: '46100 - Pacht & Miete Vereinsheim/Gaststätte', vatRateDefault: 0 },
      { code: '46200', name: 'Einnahmen aus Verpachtung Sportgelände & Tennisplätze', label: '46200 - Pachterträge Sportflächen', vatRateDefault: 0 },
      { code: '46300', name: 'Vermietung von Wohnungen / Büroräumen des Vereins', label: '46300 - Vermietung Wohnungen & Räume', vatRateDefault: 0 },
      { code: '46500', name: 'Erlöse aus der langfristigen Überlassung von Werberechten (stfrei)', label: '46500 - Überlassung Werberechte (stfrei)', vatRateDefault: 0 },
      { code: '46900', name: 'Sonstige Mieten, Pachten & Nutzungserträge', label: '46900 - Sonstige Mieten & Pachten', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-47000',
    code: '47000',
    name: 'Zinsen, Dividenden & Kapitalerträge',
    sphere: 'vermoegen',
    type: 'income',
    subCategories: [
      { code: '47000', name: 'Zinserträge aus Bankguthaben (Tagesgeld, Festgeld, Sparbuch)', label: '47000 - Zinserträge Bankkonten / Festgeld', vatRateDefault: 0 },
      { code: '47100', name: 'Zinserträge aus festverzinslichen Wertpapieren & Anleihen', label: '47100 - Zinsen Wertpapiere', vatRateDefault: 0 },
      { code: '47200', name: 'Dividenden & Erträge aus Aktien & Investmentfonds', label: '47200 - Dividenden & Fondserträge', vatRateDefault: 0 },
      { code: '47300', name: 'Zinserträge aus Darlehensgewährung', label: '47300 - Zinsen aus Darlehen', vatRateDefault: 0 },
      { code: '47900', name: 'Sonstige Finanz- & Kapitalerträge', label: '47900 - Sonstige Kapitalerträge', vatRateDefault: 0 }
    ]
  },

  // =========================================================================
  // 2. VERMÖGENSVERWALTUNG - AUSGABEN (Klasse 6)
  // =========================================================================
  {
    id: 'HK-62000-VER',
    code: '62000',
    name: 'Bewirtschaftung & Erhaltung Vermögen',
    sphere: 'vermoegen',
    type: 'expense',
    subCategories: [
      { code: '62150', name: 'Instandhaltung & Reparaturen vermieteter Immobilien', label: '62150 - Instandhaltung vermietete Liegenschaften', vatRateDefault: 0 },
      { code: '62250', name: 'Grundsteuer & öffentliche Abgaben für vermieteten Grundbesitz', label: '62250 - Grundsteuer & Gebühren vermietetes Vermögen', vatRateDefault: 0 },
      { code: '62350', name: 'Gebäude- & Brandversicherung für vermietete Objekte', label: '62350 - Gebäudeversicherung vermietete Objekte', vatRateDefault: 0 },
      { code: '62450', name: 'Hausmeister-, Wartungs- & Betriebskosten Vermietung', label: '62450 - Betriebskosten Vermietung', vatRateDefault: 0 },
      { code: '68550', name: 'Depotgebühren & Kosten der Vermögensverwaltung', label: '68550 - Depotgebühren & Verwaltungskosten', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-69000-VER',
    code: '69000',
    name: 'Abschreibungen Vermögensverwaltung',
    sphere: 'vermoegen',
    type: 'expense',
    subCategories: [
      { code: '69050', name: 'Abschreibungen auf vermietete Gebäude & Außenanlagen', label: '69050 - AfA vermietete Gebäude', vatRateDefault: 0 },
      { code: '69060', name: 'Abschreibungen auf Finanzanlagen & Wertpapiere', label: '69060 - AfA Finanzanlagen & Wertpapiere', vatRateDefault: 0 }
    ]
  },

  // =========================================================================
  // 3. ZWECKBETRIEB - EINNAHMEN (Klasse 4)
  // =========================================================================
  {
    id: 'HK-41000',
    code: '41000',
    name: 'Sportlicher Zweckbetrieb (Eintritt & Kurse)',
    sphere: 'zweckbetrieb',
    type: 'income',
    subCategories: [
      { code: '41000', name: 'Erlöse sportlicher Zweckbetrieb allgemein (7% USt)', label: '41000 - Erlöse sportlicher Zweckbetrieb (7% USt)', vatRateDefault: 7 },
      { code: '41100', name: 'Eintrittsgelder zu sportlichen Veranstaltungen & Ligaspielen (7% USt)', label: '41100 - Eintrittsgelder Sportwettkämpfe (7% USt)', vatRateDefault: 7 },
      { code: '41200', name: 'Kursgebühren, Lehrgänge & Trainingsangebote', label: '41200 - Kurs- & Lehrgangsgebühren', vatRateDefault: 0 },
      { code: '41300', name: 'Meldegelder & Startgelder bei Turnieren & Meisterschaften', label: '41300 - Melde- & Startgelder', vatRateDefault: 0 },
      { code: '41400', name: 'Verkauf von Sportlerbekleidung / Ausrüstung zum Selbstkostenpreis', label: '41400 - Sportbekleidung zum Selbstkostenpreis', vatRateDefault: 0 },
      { code: '41500', name: 'Rehabilitations- & Behindertensport (§ 4 Nr. 14 UStG stfrei)', label: '41500 - Rehasport & Gesundheitssport (stfrei)', vatRateDefault: 0 },
      { code: '41900', name: 'Sonstige Erlöse sportlicher Veranstaltungen', label: '41900 - Sonstige Erlöse Sportbetrieb', vatRateDefault: 7 }
    ]
  },
  {
    id: 'HK-42000',
    code: '42000',
    name: 'Kulturelle, bildende & sonstige Zweckbetriebe',
    sphere: 'zweckbetrieb',
    type: 'income',
    subCategories: [
      { code: '42000', name: 'Erlöse kulturelle Veranstaltungen & Aufführungen (7% USt)', label: '42000 - Kulturelle Veranstaltungen (7% USt)', vatRateDefault: 7 },
      { code: '42100', name: 'Teilnehmerbeiträge Kinder- & Jugendfreizeiten / Zeltlager', label: '42100 - Beiträge Jugendfreizeiten & Camps', vatRateDefault: 0 },
      { code: '42200', name: 'Fachtagungen, Vorträge & Bildungsseminare', label: '42200 - Seminare & Bildungsveranstaltungen', vatRateDefault: 0 },
      { code: '42300', name: 'Erlöse aus Zweckbetrieb-Verkaufserlösen', label: '42300 - Erlöse Zweckbetrieb-Verkauf', vatRateDefault: 7 },
      { code: '42900', name: 'Sonstige Erlöse Zweckbetriebe', label: '42900 - Sonstige Erlöse Zweckbetriebe', vatRateDefault: 7 }
    ]
  },

  // =========================================================================
  // 3. ZWECKBETRIEB - AUSGABEN (Klasse 6)
  // =========================================================================
  {
    id: 'HK-60000-ZWB',
    code: '60000',
    name: 'Sportliches Personal & Aufwandsentschädigungen',
    sphere: 'zweckbetrieb',
    type: 'expense',
    subCategories: [
      { code: '60020', name: 'Ehrenamtspauschale gem. § 3 Nr. 26a EStG (bis 840 €/Jahr)', label: '60020 - Ehrenamtspauschale (§ 3 Nr. 26a EStG)', vatRateDefault: 0 },
      { code: '60040', name: 'Übungsleiterpauschale gem. § 3 Nr. 26 EStG (bis 3.000 €/Jahr)', label: '60040 - Übungsleiterpauschale (§ 3 Nr. 26 EStG)', vatRateDefault: 0 },
      { code: '60050', name: 'Vergütungen für Schiedsrichter, Kampfgericht & Zeitnehmer', label: '60050 - Schiedsrichter- & Kampfrichtergelder', vatRateDefault: 0 },
      { code: '60100', name: 'Trainer- & Übungsleiterhonorare (steuerpflichtig)', label: '60100 - Trainerhonorare (steuerpflichtig)', vatRateDefault: 0 },
      { code: '60150', name: 'Gehälter für festangestellte Trainer & Sportlehrer', label: '60150 - Gehälter Trainer & Übungsleiter', vatRateDefault: 0 },
      { code: '60190', name: 'Berufsgenossenschaft (VBG) für Sportler & Trainer', label: '60190 - Berufsgenossenschaft VBG Sport', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-62000-ZWB',
    code: '62000',
    name: 'Sportstätten, Hallen & Platzpflege',
    sphere: 'zweckbetrieb',
    type: 'expense',
    subCategories: [
      { code: '62100', name: 'Hallenmieten, Sportplatzmieten & Nutzungsentgelte', label: '62100 - Hallen- & Platzmieten Sportstätten', vatRateDefault: 0 },
      { code: '62200', name: 'Energie, Strom, Gas, Heizung & Flutlichtanlagen', label: '62200 - Flutlicht, Strom & Heizung Sportbetrieb', vatRateDefault: 0 },
      { code: '62300', name: 'Wasser, Abwasser & Müllabfuhr für Sportanlagen', label: '62300 - Wasser, Abwasser & Müll Sportstätten', vatRateDefault: 0 },
      { code: '62400', name: 'Reinigung von Umkleiden, Hallen & Sportanlagen', label: '62400 - Reinigung Hallen & Umkleiden', vatRateDefault: 0 },
      { code: '62500', name: 'Instandhaltung, Reparaturen & Renovierung Sportstätten', label: '62500 - Instandhaltung Sportanlagen', vatRateDefault: 0 },
      { code: '62600', name: 'Platzpflege, Rasenmähen, Dünger, Saatgut & Linierfarbe', label: '62600 - Rasenpflege, Dünger & Linierfarbe', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-63000-ZWB',
    code: '63000',
    name: 'Reisekosten, Fahrten & Trainingslager',
    sphere: 'zweckbetrieb',
    type: 'expense',
    subCategories: [
      { code: '63100', name: 'Fahrtkostenerstattung Sportler & Trainer (Auswärtsspiele)', label: '63100 - Fahrtkosten Sportler & Trainer', vatRateDefault: 0 },
      { code: '63200', name: 'Übernachtungs- & Verpflegungsmehraufwand Wettkämpfe', label: '63200 - Übernachtung & Spesen Wettkämpfe', vatRateDefault: 0 },
      { code: '63300', name: 'Kosten für Trainingslager & Saisonvorbereitung', label: '63300 - Kosten Trainingslager', vatRateDefault: 0 },
      { code: '63400', name: 'Anmietung von Bussen / Kleinbussen für Mannschaftsfahrten', label: '63400 - Busanmietung Mannschaftsfahrten', vatRateDefault: 0 },
      { code: '64100', name: 'Treibstoffe für Vereinsbus (Sportbetrieb)', label: '64100 - Kraftstoff Vereinsbus (Sport)', vatRateDefault: 0 },
      { code: '64200', name: 'Kfz-Versicherung, Steuer & Wartung Vereinsbus', label: '64200 - Kfz-Kosten & Wartung Vereinsbus', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-65000-ZWB',
    code: '65000',
    name: 'Spielbetrieb, Sportgeräte & Trikots',
    sphere: 'zweckbetrieb',
    type: 'expense',
    subCategories: [
      { code: '65100', name: 'Sportgeräte & Trainingsmaterial (Bälle, Hütchen, Netze, Matten)', label: '65100 - Sportgeräte & Trainingsmaterial', vatRateDefault: 0 },
      { code: '65200', name: 'Sportkleidung, Trikotsätze & Schutzausrüstung (Vereinsbedarf)', label: '65200 - Trikotsätze & Vereinsausstattung', vatRateDefault: 0 },
      { code: '65300', name: 'Erste-Hilfe-Koffer, Medizinkoffer, Tape & Eisspray', label: '65300 - Medizinische Erstversorgung & Tape', vatRateDefault: 0 },
      { code: '65400', name: 'Pokale, Medaillen, Urkunden & Siegerehrungen', label: '65400 - Pokale, Medaillen & Urkunden', vatRateDefault: 0 },
      { code: '65500', name: 'Schiedsrichter-Spesen, Fahrtkosten & Schiedsrichterverpflegung', label: '65500 - Schiedsrichterspesen & Verpflegung', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-66000-ZWB',
    code: '66000',
    name: 'Startgelder, Meldegelder & Lizenzen',
    sphere: 'zweckbetrieb',
    type: 'expense',
    subCategories: [
      { code: '66150', name: 'Startgelder & Meldegelder für Verbandswettkämpfe & Turniere', label: '66150 - Startgelder Verband & Turniere', vatRateDefault: 0 },
      { code: '66200', name: 'Spielerpässe, Lizenzgebühren & Spielberechtigungen', label: '66200 - Spielerpässe & Lizenzgebühren', vatRateDefault: 0 },
      { code: '66300', name: 'Sportgerichtskosten, Ordnungsgelder & Verwarnungen', label: '66300 - Sportgerichtskosten & Ordnungsgelder', vatRateDefault: 0 },
      { code: '66400', name: 'Sportunfallversicherung & Sporthilfebeiträge', label: '66400 - Sportunfallversicherung', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-69000-ZWB',
    code: '69000',
    name: 'Abschreibungen Zweckbetrieb',
    sphere: 'zweckbetrieb',
    type: 'expense',
    subCategories: [
      { code: '69100', name: 'Abschreibungen auf Sportanlagen, Flutlicht & Großgeräte', label: '69100 - AfA Sportanlagen & Großgeräte', vatRateDefault: 0 },
      { code: '69150', name: 'Abschreibungen auf Fuhrpark (Vereinsbus)', label: '69150 - AfA Vereinsbus', vatRateDefault: 0 },
      { code: '69250', name: 'Sofortabschreibung geringwertiger Wirtschaftsgüter Sportbetrieb (GWG)', label: '69250 - GWG-Sofortabschreibung Sportgeräte', vatRateDefault: 0 }
    ]
  },

  // =========================================================================
  // 4. WIRTSCHAFTLICHER GESCHÄFTSBETRIEB - EINNAHMEN (Klasse 4)
  // =========================================================================
  {
    id: 'HK-43000',
    code: '43000',
    name: 'Gastronomie, Kiosk & Vereinsfeste',
    sphere: 'wirtschaftlich',
    type: 'income',
    subCategories: [
      { code: '43000', name: 'Erlöse Gastronomie & Kioskbetrieb allgemein (19% USt)', label: '43000 - Erlöse Gastronomie allgemein (19% USt)', vatRateDefault: 19 },
      { code: '43100', name: 'Verkauf von Speisen im Kiosk / Vereinsheim (7% / 19% USt)', label: '43100 - Verkauf Speisen Kiosk / Kantine', vatRateDefault: 19 },
      { code: '43150', name: 'Verkauf von Getränken im Kiosk / Kantine (19% USt)', label: '43150 - Verkauf Getränke Kiosk (19% USt)', vatRateDefault: 19 },
      { code: '43200', name: 'Erlöse aus Vereinsfesten, Sommerfest & Grillabend (19% USt)', label: '43200 - Bewirtung Vereinsfeste & Turniere (19% USt)', vatRateDefault: 19 },
      { code: '43250', name: 'Pfanderlöse & Getränkemarken', label: '43250 - Pfand & Wertmarken Gastronomie', vatRateDefault: 19 },
      { code: '43900', name: 'Sonstige Bewirtungserlöse', label: '43900 - Sonstige Bewirtungserlöse (19% USt)', vatRateDefault: 19 }
    ]
  },
  {
    id: 'HK-44000',
    code: '44000',
    name: 'Werbung, Sponsoring & Marketing',
    sphere: 'wirtschaftlich',
    type: 'income',
    subCategories: [
      { code: '44000', name: 'Werbeeinnahmen & Sponsoring allgemein (19% USt)', label: '44000 - Sponsoring & Werbung allgemein (19% USt)', vatRateDefault: 19 },
      { code: '44100', name: 'Bandenwerbung auf der Sportanlage (19% USt)', label: '44100 - Bandenwerbung Sportplatz (19% USt)', vatRateDefault: 19 },
      { code: '44200', name: 'Trikotwerbung & Ausrüstungssponsoring (19% USt)', label: '44200 - Trikotwerbung & Textilsponsoring (19% USt)', vatRateDefault: 19 },
      { code: '44300', name: 'Inserate in Stadionzeitung, Vereinsheft & Spieltagsheft (19% USt)', label: '44300 - Anzeigen & Inserate Vereinszeitung (19% USt)', vatRateDefault: 19 },
      { code: '44400', name: 'Lautsprecher- & Durchsagewerbung bei Spielen (19% USt)', label: '44400 - Lautsprecherwerbung (19% USt)', vatRateDefault: 19 },
      { code: '44500', name: 'Namensrechte & Titelsponsoring (Stadion, Halle) (19% USt)', label: '44500 - Namensrechte & Titelsponsoring (19% USt)', vatRateDefault: 19 },
      { code: '44900', name: 'Sonstige Werbe- & Marketingerlöse', label: '44900 - Sonstige Werbeeinnahmen (19% USt)', vatRateDefault: 19 }
    ]
  },
  {
    id: 'HK-45000',
    code: '45000',
    name: 'Merchandising & sonstige wirtschaftliche Betriebe',
    sphere: 'wirtschaftlich',
    type: 'income',
    subCategories: [
      { code: '45100', name: 'Verkauf von Fanartikeln, Schals & Merchandising (19% USt)', label: '45100 - Merchandising & Fanartikelverkauf (19% USt)', vatRateDefault: 19 },
      { code: '45200', name: 'Kurzfristige Vermietung von Vereinsräumen für Privatfeiern (19% USt)', label: '45200 - Vermietung Vereinsheim für Privatfeiern (19% USt)', vatRateDefault: 19 },
      { code: '45300', name: 'Einnahmen aus Tombola, Losverkauf & Glücksrad', label: '45300 - Tombola & Losverkauf', vatRateDefault: 19 },
      { code: '45900', name: 'Sonstige Erlöse wirtschaftlicher Geschäftsbetrieb', label: '45900 - Sonstige wirtschaftliche Erlöse (19% USt)', vatRateDefault: 19 }
    ]
  },

  // =========================================================================
  // 4. WIRTSCHAFTLICHER GESCHÄFTSBETRIEB - AUSGABEN (Klasse 5, 6 & 7)
  // =========================================================================
  {
    id: 'HK-50000-WGB',
    code: '50000',
    name: 'Wareneinsatz Gastronomie, Kiosk & Feste',
    sphere: 'wirtschaftlich',
    type: 'expense',
    subCategories: [
      { code: '51000', name: 'Wareneinkauf Speisen (Bratwurst, Brötchen, Pommes) (7% Vorsteuer)', label: '51000 - Wareneinkauf Speisen (7% Vorsteuer)', vatRateDefault: 7 },
      { code: '51100', name: 'Wareneinkauf Getränke (Bier, alkoholfreie Getränke, Wasser) (19% Vorsteuer)', label: '51100 - Wareneinkauf Getränke (19% Vorsteuer)', vatRateDefault: 19 },
      { code: '52000', name: 'Wareneinkauf Fanartikel, Schals & Bekleidung zum Weiterverkauf (19% Vorsteuer)', label: '52000 - Wareneinkauf Fanartikel / Merchandise', vatRateDefault: 19 },
      { code: '53000', name: 'Fremdleistungen Gastronomie, Catering & Foodtruck', label: '53000 - Fremdleistungen Catering & Foodtruck', vatRateDefault: 19 },
      { code: '58000', name: 'Verbrauchsmaterial Kiosk (Pappteller, Becher, Servietten, Grillkohle)', label: '58000 - Verpackung & Verbrauchsmaterial Kiosk', vatRateDefault: 19 }
    ]
  },
  {
    id: 'HK-60000-WGB',
    code: '60000',
    name: 'Personal wirtschaftlicher Geschäftsbetrieb',
    sphere: 'wirtschaftlich',
    type: 'expense',
    subCategories: [
      { code: '60200', name: 'Löhne & Aushilfskräfte Kiosk, Kantine & Thekendienst', label: '60200 - Aushilfslöhne Kiosk & Thekendienst', vatRateDefault: 0 },
      { code: '60250', name: 'Platzwartvergütung wirtschaftlicher Anteil', label: '60250 - Platzwartvergütung wirtschaftlicher Anteil', vatRateDefault: 0 },
      { code: '61150', name: 'Pauschale Steuern & Sozialabgaben für Minijobs Kiosk', label: '61150 - Pauschale Abgaben Minijobs Kiosk', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-67000-WGB',
    code: '67000',
    name: 'Aufwand für Werbung & Sponsorenbetreuung',
    sphere: 'wirtschaftlich',
    type: 'expense',
    subCategories: [
      { code: '67100', name: 'Herstellungskosten für Werbebanden, Banner & Schilder', label: '67100 - Herstellung Werbebanden & Schilder', vatRateDefault: 19 },
      { code: '67200', name: 'Druck- und Satzkosten für Stadionheft & Werbeflyer', label: '67200 - Druckkosten Stadionheft & Werbemedien', vatRateDefault: 19 },
      { code: '67300', name: 'Geschenke & Bewirtung von Sponsoren & Werbepartnern', label: '67300 - Sponsorenbetreuung & Geschenke', vatRateDefault: 19 },
      { code: '67900', name: 'Sonstiger Werbe- & Akquiseaufwand', label: '67900 - Sonstiger Werbeaufwand', vatRateDefault: 19 }
    ]
  },
  {
    id: 'HK-73000-WGB',
    code: '73000',
    name: 'Ertragssteuern & Abgaben wirtschaftlicher Betrieb',
    sphere: 'wirtschaftlich',
    type: 'expense',
    subCategories: [
      { code: '73100', name: 'Körperschaftsteuer & Solidaritätszuschlag', label: '73100 - Körperschaftsteuer & Soli', vatRateDefault: 0 },
      { code: '73200', name: 'Gewerbesteuer an die Stadt / Gemeinde', label: '73200 - Gewerbesteuer', vatRateDefault: 0 },
      { code: '73300', name: 'Zinsen & Säumniszuschläge Betriebssteuern', label: '73300 - Zinsen & Säumniszuschläge Steuern', vatRateDefault: 0 },
      { code: '73900', name: 'Sonstige Steuern wirtschaftlicher Geschäftsbetrieb', label: '73900 - Sonstige Betriebssteuern', vatRateDefault: 0 }
    ]
  },
  {
    id: 'HK-69000-WGB',
    code: '69000',
    name: 'Abschreibungen wirtschaftlicher Betrieb',
    sphere: 'wirtschaftlich',
    type: 'expense',
    subCategories: [
      { code: '69300', name: 'Abschreibungen auf Gastronomieausstattung (Zapfanlage, Kühlschränke, Grill)', label: '69300 - AfA Gastronomieausstattung', vatRateDefault: 0 },
      { code: '69400', name: 'Sofortabschreibung geringwertiger Wirtschaftsgüter Kiosk / Bewirtung (GWG)', label: '69400 - GWG-Sofortabschreibung Kiosk', vatRateDefault: 0 }
    ]
  }
];

// Helper functions for SKR 42
export const getAllSkr42MainCategories = (type?: 'income' | 'expense'): Skr42MainCategory[] => {
  if (!type) return SKR42_STRUCTURE;
  return SKR42_STRUCTURE.filter(m => m.type === type);
};

export const getSkr42MainCategories = (sphere: TaxSphere, type: 'income' | 'expense'): Skr42MainCategory[] => {
  return SKR42_STRUCTURE.filter(m => m.sphere === sphere && m.type === type);
};

export const getSkr42SubCategories = (
  sphere: TaxSphere,
  type: 'income' | 'expense',
  mainCategoryId?: string
): Skr42SubCategory[] => {
  if (mainCategoryId) {
    const found = SKR42_STRUCTURE.find(
      m => m.id === mainCategoryId || m.code === mainCategoryId || m.name === mainCategoryId || `${m.code} - ${m.name}` === mainCategoryId
    );
    if (found) return found.subCategories;
  }
  const mains = getSkr42MainCategories(sphere, type);
  return mains.flatMap(m => m.subCategories);
};

// Legacy 4-digit to 5-digit SKR 42 code mapping table for seamless backwards-compatibility
const LEGACY_CODE_MAP: Record<string, string> = {
  // Income
  '3100': '40000',
  '3110': '40000',
  '3120': '40010',
  '3130': '40020',
  '3140': '40030',
  '3200': '40400',
  '3210': '40450',
  '3220': '40460',
  '3230': '40550',
  '3240': '40560',
  '3250': '40600',
  '3300': '40700',
  '3310': '40710',
  '3320': '40720',
  '3400': '40800',
  '3500': '47000',
  '3520': '47200',
  '3600': '46100',
  '3620': '46200',
  '4110': '41100',
  '4120': '41300',
  '4200': '41200',
  '4300': '41400',
  '4500': '44100',
  '4610': '43200',
  '4620': '43100',
  '4700': '45100',
  // Expense
  '5000': '50010',
  '5100': '66100',
  '5200': '68100',
  '5500': '62150',
  '6000': '65100',
  '6100': '62100',
  '6200': '63100',
  '6500': '60040',
  '6600': '65100',
  '6700': '66150',
  '7100': '51000',
  '7200': '60200',
  '7300': '67100'
};

/**
 * Finds matching SKR42 main category from an ID, code, or name
 */
export const findSkr42Main = (identifier: string): Skr42MainCategory | undefined => {
  if (!identifier) return undefined;
  const clean = identifier.trim();

  // Check direct match on id, code, name
  const direct = SKR42_STRUCTURE.find(
    m =>
      m.id === clean ||
      m.code === clean ||
      m.name.toLowerCase() === clean.toLowerCase() ||
      `${m.code} - ${m.name}`.toLowerCase() === clean.toLowerCase() ||
      clean.startsWith(m.code)
  );
  if (direct) return direct;

  // Check legacy map
  const legacyMapped = LEGACY_CODE_MAP[clean];
  if (legacyMapped) {
    const fromLegacy = SKR42_STRUCTURE.find(m => m.code === legacyMapped || m.subCategories.some(s => s.code === legacyMapped));
    if (fromLegacy) return fromLegacy;
  }

  return findSkr42MainForSub(clean);
};

/**
 * Finds matching SKR42 main category from a subcategory name or code
 */
export const findSkr42MainForSub = (subNameOrCode: string): Skr42MainCategory | undefined => {
  if (!subNameOrCode) return undefined;
  const clean = subNameOrCode.trim().toLowerCase();

  // Check if it's a legacy 4-digit code
  const legacyTarget = LEGACY_CODE_MAP[subNameOrCode.trim()];
  if (legacyTarget) {
    const foundByLegacy = SKR42_STRUCTURE.find(main =>
      main.subCategories.some(sub => sub.code === legacyTarget)
    );
    if (foundByLegacy) return foundByLegacy;
  }

  return SKR42_STRUCTURE.find(main =>
    main.subCategories.some(
      sub =>
        sub.label.toLowerCase() === clean ||
        sub.name.toLowerCase() === clean ||
        sub.code === subNameOrCode.trim() ||
        clean.includes(sub.code) ||
        clean.includes(sub.name.toLowerCase())
    )
  );
};

/**
 * Finds a specific SKR42 subcategory by code, label, or name
 */
export const findSkr42SubCategory = (codeOrLabel: string): { sub: Skr42SubCategory; main: Skr42MainCategory } | undefined => {
  if (!codeOrLabel) return undefined;
  const clean = codeOrLabel.trim().toLowerCase();
  const rawCode = codeOrLabel.trim();

  // Check direct 5-digit search
  for (const main of SKR42_STRUCTURE) {
    for (const sub of main.subCategories) {
      if (
        sub.code === rawCode ||
        sub.label.toLowerCase() === clean ||
        sub.name.toLowerCase() === clean ||
        clean.startsWith(sub.code)
      ) {
        return { sub, main };
      }
    }
  }

  // Check legacy 4-digit mapping
  const mapped = LEGACY_CODE_MAP[rawCode];
  if (mapped) {
    for (const main of SKR42_STRUCTURE) {
      for (const sub of main.subCategories) {
        if (sub.code === mapped) {
          return { sub, main };
        }
      }
    }
  }

  return undefined;
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
