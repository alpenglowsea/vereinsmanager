import { DashboardWidgetDefinition, DashboardWidgetConfig, UserDashboardConfig, DashboardPreset } from '../types/dashboard';

export const AVAILABLE_DASHBOARD_WIDGETS: DashboardWidgetDefinition[] = [
  // 1. Übersicht & Schnellaktionen
  {
    id: 'quick_actions',
    title: 'Schnellzugriff',
    shortTitle: 'Schnellzugriff',
    description: 'Direkter Schnellzugriff zum Anlegen neuer Mitglieder, Buchungen, Termine, Inventargegenstände und Dokumente.',
    category: 'overview',
    categoryLabel: 'Übersicht & Aktionen',
    iconName: 'Sparkles',
    defaultColSpan: 4,
    minColSpan: 2,
    maxColSpan: 4,
    defaultEnabled: true,
    defaultOrder: 1,
    tags: ['Aktionen', 'Buttons', 'Erstellen', 'Neu']
  },
  {
    id: 'club_header',
    title: 'Vereinsstammdaten & Status',
    shortTitle: 'Vereinskopf',
    description: 'Offizieller Vereinsname, Registernummer, Gemeinnützigkeitsstatus und Leitungsangaben.',
    category: 'overview',
    categoryLabel: 'Übersicht & Aktionen',
    iconName: 'Building2',
    defaultColSpan: 4,
    minColSpan: 2,
    maxColSpan: 4,
    defaultEnabled: true,
    defaultOrder: 2,
    tags: ['Verein', 'Kopf', 'Stammdaten']
  },

  // 2. Mitglieder (Untermenüs: Mitglieder, Online-Anträge, Statistiken)
  {
    id: 'members_kpi',
    title: 'Mitglieder-Kennzahlen',
    shortTitle: 'Mitgliederbestand',
    description: 'Gesamtanzahl der Mitglieder mit Aufteilung nach aktiven, passiven und ruhenden Mitgliedern.',
    category: 'members',
    categoryLabel: 'Mitglieder',
    iconName: 'Users',
    defaultColSpan: 1,
    minColSpan: 1,
    maxColSpan: 2,
    defaultEnabled: true,
    defaultOrder: 3,
    tags: ['Mitglieder', 'Bestand', 'Aktiv', 'Passiv']
  },
  {
    id: 'online_applications_kpi',
    title: 'Online-Mitgliedsanträge',
    shortTitle: 'Offene Anträge',
    description: 'Übersicht über neu eingegangene und zur Prüfung ausstehende digitale Aufnahmeanträge.',
    category: 'members',
    categoryLabel: 'Mitglieder',
    iconName: 'FileSignature',
    defaultColSpan: 2,
    minColSpan: 1,
    maxColSpan: 4,
    defaultEnabled: true,
    defaultOrder: 4,
    tags: ['Aufnahme', 'Anträge', 'Online', 'Digital']
  },
  {
    id: 'departments_distribution',
    title: 'Abteilungen & Sparten',
    shortTitle: 'Spartenverteilung',
    description: 'Verteilung der Mitglieder auf die verschiedenen Sport- und Vereinsabteilungen.',
    category: 'members',
    categoryLabel: 'Mitglieder',
    iconName: 'Layers',
    defaultColSpan: 1,
    minColSpan: 1,
    maxColSpan: 4,
    defaultEnabled: true,
    defaultOrder: 5,
    tags: ['Abteilungen', 'Sparten', 'Sportarten']
  },
  {
    id: 'upcoming_birthdays',
    title: 'Nächste Geburtstage & Jubiläen',
    shortTitle: 'Geburtstage',
    description: 'Anstehende runde Geburtstage und Vereinsjubiläen in den kommenden 30 Tagen.',
    category: 'members',
    categoryLabel: 'Mitglieder',
    iconName: 'Gift',
    defaultColSpan: 1,
    minColSpan: 1,
    maxColSpan: 3,
    defaultEnabled: true,
    defaultOrder: 6,
    tags: ['Geburtstag', 'Jubiläum', 'Ehrung', 'Feier']
  },
  {
    id: 'recent_members',
    title: 'Neueste Mitgliederzugänge',
    shortTitle: 'Neue Mitglieder',
    description: 'Die zuletzt eingetretenen Mitglieder mit Datum, Abteilung und Beitragsart.',
    category: 'members',
    categoryLabel: 'Mitglieder',
    iconName: 'UserPlus',
    defaultColSpan: 2,
    minColSpan: 1,
    maxColSpan: 4,
    defaultEnabled: false,
    defaultOrder: 7,
    tags: ['Neuzugänge', 'Eintritt', 'Mitglieder']
  },
  {
    id: 'demographics_distribution',
    title: 'Alters- & Demografiestruktur',
    shortTitle: 'Altersstruktur',
    description: 'Aufteilung der Mitglieder nach Altersgruppen (Kinder/Jugend, Erwachsene, Senioren).',
    category: 'members',
    categoryLabel: 'Mitglieder',
    iconName: 'BarChart3',
    defaultColSpan: 2,
    minColSpan: 1,
    maxColSpan: 4,
    defaultEnabled: false,
    defaultOrder: 8,
    tags: ['Demografie', 'Alter', 'Geschlecht', 'Statistik']
  },

  // 3. Finanzen (Untermenüs: Buchungen, Beitragslauf SEPA, EÜR/GuV, Spenden, Finanzanalysen)
  {
    id: 'total_liquidity',
    title: 'Gesamtliquidität & Kontensalden',
    shortTitle: 'Liquidität',
    description: 'Aktuelle Bank- und Kassenstände aller Vereinskonten mit Gesamtsaldo.',
    category: 'finance',
    categoryLabel: 'Finanzen & Steuern',
    iconName: 'Wallet',
    defaultColSpan: 1,
    minColSpan: 1,
    maxColSpan: 2,
    defaultEnabled: true,
    defaultOrder: 9,
    tags: ['Girokonto', 'Barkasse', 'Kontostand', 'Liquidität']
  },
  {
    id: 'annual_balance',
    title: 'Jahres-Saldo (EÜR YTD)',
    shortTitle: 'Jahres-Saldo',
    description: 'Gesamteinnahmen, Gesamtausgaben und aktuelles Netto-Ergebnis des laufenden Geschäftsjahres.',
    category: 'finance',
    categoryLabel: 'Finanzen & Steuern',
    iconName: 'ShieldCheck',
    defaultColSpan: 1,
    minColSpan: 1,
    maxColSpan: 2,
    defaultEnabled: true,
    defaultOrder: 10,
    tags: ['EÜR', 'GuV', 'Einnahmen', 'Ausgaben', 'Saldo']
  },
  {
    id: 'wgb_limit_monitor',
    title: '§ 64 AO Freigrenze (WGB 45.000 €)',
    shortTitle: '§ 64 AO Grenze',
    description: 'Überwachung der steuerfreien Einnahmengrenze im wirtschaftlichen Geschäftsbetrieb mit Pufferanzeige.',
    category: 'finance',
    categoryLabel: 'Finanzen & Steuern',
    iconName: 'Percent',
    defaultColSpan: 1,
    minColSpan: 1,
    maxColSpan: 2,
    defaultEnabled: true,
    defaultOrder: 11,
    tags: ['Steuern', 'WGB', 'Finanzamt', 'Freigrenze']
  },
  {
    id: 'tax_spheres_overview',
    title: '4 Steuerliche Sphären (SKR 42)',
    shortTitle: '4 Sphären (SKR 42)',
    description: 'Aufschlüsselung der Einnahmen/Ausgaben nach Ideellem Bereich, Vermögensverwaltung, Zweckbetrieb und WGB.',
    category: 'finance',
    categoryLabel: 'Finanzen & Steuern',
    iconName: 'Layers',
    defaultColSpan: 2,
    minColSpan: 2,
    maxColSpan: 4,
    defaultEnabled: true,
    defaultOrder: 12,
    tags: ['SKR42', 'Sphären', 'Gemeinnützigkeit', 'DATEV']
  },
  {
    id: 'sepa_debit_monitor',
    title: 'Beitragslauf & SEPA-Monitor',
    shortTitle: 'SEPA-Beitragslauf',
    description: 'Status der SEPA-Mandate, Zahlungsarten-Verteilung und Schnellstart für den XML-Export.',
    category: 'finance',
    categoryLabel: 'Finanzen & Steuern',
    iconName: 'CreditCard',
    defaultColSpan: 2,
    minColSpan: 1,
    maxColSpan: 4,
    defaultEnabled: true,
    defaultOrder: 13,
    tags: ['SEPA', 'Lastschrift', 'Beitragslauf', 'XML']
  },
  {
    id: 'recent_journal_transactions',
    title: 'Letzte Buchungen im Journal',
    shortTitle: 'Letzte Buchungen',
    description: 'Die aktuellsten Finanzbuchungen mit Belegnummer, Partner, Kategorie und Betrag.',
    category: 'finance',
    categoryLabel: 'Finanzen & Steuern',
    iconName: 'FileSpreadsheet',
    defaultColSpan: 2,
    minColSpan: 2,
    maxColSpan: 4,
    defaultEnabled: true,
    defaultOrder: 14,
    tags: ['Buchungen', 'Journal', 'Belege', 'Kasse']
  },
  {
    id: 'donations_summary',
    title: 'Spenden & BMF-Zuwendungen',
    shortTitle: 'Spenden & Zuwendungen',
    description: 'Gespendetes Volumen im laufenden Jahr, ausgestellte Spendenbescheinigungen und Geld-/Sachspenden.',
    category: 'finance',
    categoryLabel: 'Finanzen & Steuern',
    iconName: 'HeartHandshake',
    defaultColSpan: 1,
    minColSpan: 1,
    maxColSpan: 3,
    defaultEnabled: true,
    defaultOrder: 15,
    tags: ['Spenden', 'BMF', 'Zuwendungsbestätigung', 'Sponsoring']
  },
  {
    id: 'cashflow_chart',
    title: 'Monatlicher Finanz-Cashflow',
    shortTitle: 'Cashflow-Verlauf',
    description: 'Entwicklung der Einnahmen und Ausgaben über die letzten Monate im Jahresverlauf.',
    category: 'finance',
    categoryLabel: 'Finanzen & Steuern',
    iconName: 'TrendingUp',
    defaultColSpan: 2,
    minColSpan: 1,
    maxColSpan: 4,
    defaultEnabled: false,
    defaultOrder: 16,
    tags: ['Cashflow', 'Trend', 'Monate', 'Finanzen']
  },

  // 4. Kalender & Termine
  {
    id: 'upcoming_events',
    title: 'Nächste Vereinstermine & Fristen',
    shortTitle: 'Terminkalender',
    description: 'Anstehende Spiele, Turniere, Vorstandssitzungen, Versammlungen und behördliche Fristen.',
    category: 'calendar',
    categoryLabel: 'Kalender & Termine',
    iconName: 'CalendarDays',
    defaultColSpan: 2,
    minColSpan: 1,
    maxColSpan: 4,
    defaultEnabled: true,
    defaultOrder: 17,
    tags: ['Termine', 'Kalender', 'Fristen', 'Events']
  },

  // 5. Inventar
  {
    id: 'inventory_overview',
    title: 'Inventar & Materialbestand',
    shortTitle: 'Inventar-Übersicht',
    description: 'Gesamter materieller Vereinswert, Gerätebestand, Zustand und letzte Anschaffungen.',
    category: 'inventory',
    categoryLabel: 'Inventar',
    iconName: 'Package',
    defaultColSpan: 1,
    minColSpan: 1,
    maxColSpan: 3,
    defaultEnabled: true,
    defaultOrder: 18,
    tags: ['Inventar', 'Material', 'Geräte', 'Sportgeräte']
  },

  // 6. Dokumente
  {
    id: 'documents_archive_kpi',
    title: 'Dokumentenarchiv & Belege',
    shortTitle: 'Dokumentenarchiv',
    description: 'Archivierte Vereinsverträge, Satzung, Protokolle, Rechnungen und OCR-gescannte Belege.',
    category: 'documents',
    categoryLabel: 'Dokumente',
    iconName: 'FolderArchive',
    defaultColSpan: 1,
    minColSpan: 1,
    maxColSpan: 3,
    defaultEnabled: true,
    defaultOrder: 19,
    tags: ['Dokumente', 'Archiv', 'Satzung', 'Protokolle']
  }
];

export const DEFAULT_DASHBOARD_CONFIG: UserDashboardConfig = {
  version: 1,
  widgets: AVAILABLE_DASHBOARD_WIDGETS.map((w, index) => ({
    id: w.id,
    enabled: w.defaultEnabled,
    order: w.defaultOrder || index + 1,
    colSpan: w.defaultColSpan
  }))
};

export const getPresetConfig = (preset: DashboardPreset): UserDashboardConfig => {
  const base = AVAILABLE_DASHBOARD_WIDGETS.map((w, index) => ({
    id: w.id,
    enabled: false,
    order: index + 1,
    colSpan: w.defaultColSpan
  }));

  if (preset === 'all') {
    return {
      version: 1,
      widgets: base.map((w, i) => ({ ...w, enabled: true, order: i + 1 }))
    };
  }

  if (preset === 'finance') {
    const enabledIds = [
      'quick_actions',
      'total_liquidity',
      'annual_balance',
      'wgb_limit_monitor',
      'donations_summary',
      'tax_spheres_overview',
      'sepa_debit_monitor',
      'recent_journal_transactions',
      'cashflow_chart',
      'documents_archive_kpi'
    ];
    return {
      version: 1,
      widgets: base.map((w, i) => ({
        ...w,
        enabled: enabledIds.includes(w.id),
        order: enabledIds.indexOf(w.id) !== -1 ? enabledIds.indexOf(w.id) + 1 : i + 50,
        colSpan: w.id === 'cashflow_chart' ? 4 : w.colSpan
      }))
    };
  }

  if (preset === 'members') {
    const enabledIds = [
      'quick_actions',
      'members_kpi',
      'online_applications_kpi',
      'departments_distribution',
      'upcoming_birthdays',
      'recent_members',
      'demographics_distribution',
      'upcoming_events'
    ];
    return {
      version: 1,
      widgets: base.map((w, i) => ({
        ...w,
        enabled: enabledIds.includes(w.id),
        order: enabledIds.indexOf(w.id) !== -1 ? enabledIds.indexOf(w.id) + 1 : i + 50
      }))
    };
  }

  if (preset === 'compact') {
    const enabledIds = [
      'members_kpi',
      'total_liquidity',
      'annual_balance',
      'wgb_limit_monitor',
      'tax_spheres_overview',
      'sepa_debit_monitor',
      'recent_journal_transactions'
    ];
    return {
      version: 1,
      widgets: base.map((w, i) => ({
        ...w,
        enabled: enabledIds.includes(w.id),
        order: enabledIds.indexOf(w.id) !== -1 ? enabledIds.indexOf(w.id) + 1 : i + 50
      }))
    };
  }

  // Default preset
  return DEFAULT_DASHBOARD_CONFIG;
};
