import { DocumentFolder } from '../types';

export function getInitialFolders(): DocumentFolder[] {
  const now = '2024-01-01T08:00:00.000Z';
  return [
    // 1. Verträge & Vereinbarungen
    {
      id: 'folder-vertraege',
      name: 'Verträge & Vereinbarungen',
      category: 'vertraege',
      color: '#3b82f6', // Blue
      description: 'Miet-, Pacht-, Trainer- und Sponsoringverträge',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'folder-trainer',
      name: 'Übungsleiter & Trainer',
      parentId: 'folder-vertraege',
      category: 'vertraege',
      color: '#06b6d4', // Cyan
      description: 'Honorare, Ehrenamtspauschalen & Übungsleitervereinbarungen',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'folder-pacht',
      name: 'Miet- & Pachtverträge',
      parentId: 'folder-vertraege',
      category: 'vertraege',
      color: '#6366f1', // Indigo
      description: 'Pachtverträge Sportstätten, Gastronomie und Vereinsheim',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'folder-sponsoring',
      name: 'Sponsoring- & Werbepartner',
      parentId: 'folder-vertraege',
      category: 'vertraege',
      color: '#8b5cf6', // Violet
      description: 'Bandenwerbung, Trikotsponsoring und Fördervereinbarungen',
      createdAt: now,
      updatedAt: now
    },

    // 2. Belege & Finanzen
    {
      id: 'folder-belege',
      name: 'Buchhaltungsbelege & Finanzen',
      category: 'belege',
      color: '#10b981', // Emerald
      description: 'Ein- und Ausgangsrechnungen, Quittungen und Spendenbelege',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'folder-belege-2025',
      name: 'Belege 2025',
      parentId: 'folder-belege',
      category: 'belege',
      color: '#10b981',
      description: 'Rechnungen und Zahlungsnachweise des Geschäftsjahres 2025',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'folder-belege-2026',
      name: 'Belege 2026',
      parentId: 'folder-belege',
      category: 'belege',
      color: '#14b8a6',
      description: 'Laufendes Geschäftsjahr 2026',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'folder-spenden',
      name: 'Spendenbestätigungen (BMF)',
      parentId: 'folder-belege',
      category: 'belege',
      color: '#059669',
      description: 'Geld- und Sachzuwendungsbescheinigungen',
      createdAt: now,
      updatedAt: now
    },

    // 3. Protokolle & Versammlungen
    {
      id: 'folder-protokolle',
      name: 'Protokolle & Niederschriften',
      category: 'protokolle',
      color: '#f59e0b', // Amber
      description: 'Jahreshauptversammlungen, Vorstandssitzungen & Abteilungsberichte',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'folder-jhv',
      name: 'Jahreshauptversammlungen (JHV)',
      parentId: 'folder-protokolle',
      category: 'protokolle',
      color: '#d97706',
      description: 'Niederschriften und Anwesenheitslisten der Mitgliederversammlungen',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'folder-vorstand',
      name: 'Vorstandssitzungen',
      parentId: 'folder-protokolle',
      category: 'protokolle',
      color: '#b45309',
      description: 'Monatliche Beschlussprotokolle des geschäftsführenden Vorstands',
      createdAt: now,
      updatedAt: now
    },

    // 4. Satzung & Ordnungen
    {
      id: 'folder-satzung',
      name: 'Satzung & Ordnungen',
      category: 'satzung',
      color: '#8b5cf6', // Violet
      description: 'Vereinssatzung, Beitragsordnung, Geschäfts- und Ehrenordnung',
      createdAt: now,
      updatedAt: now
    },

    // 5. Finanzamt & Behörden
    {
      id: 'folder-bescheide',
      name: 'Finanzamt & Behörden',
      category: 'bescheide',
      color: '#ef4444', // Red
      description: 'Freistellungsbescheide, Vereinsregisterauszüge und Steuerbescheinigungen',
      createdAt: now,
      updatedAt: now
    },

    // 6. Mitglieder & Beitritte
    {
      id: 'folder-mitglieder',
      name: 'Mitglieder & Beitrittswesen',
      category: 'mitglieder',
      color: '#0284c7', // Sky Blue
      description: 'Mitgliederakten, Eintrittserklärungen & SEPA-Mandate',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'folder-aufnahmeantraege',
      name: 'Digitale Aufnahmeanträge',
      parentId: 'folder-mitglieder',
      category: 'mitglieder',
      color: '#0369a1',
      description: 'Vollständig digital erfasste und signierte Mitgliedsanträge',
      createdAt: now,
      updatedAt: now
    },

    // 7. Veranstaltungen & Projekte
    {
      id: 'folder-events',
      name: 'Projekte & Vereinsfeste',
      category: 'sonstiges',
      color: '#ec4899', // Pink
      description: 'Planungsunterlagen, Sommerfeste, Turniere & Flyer',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'folder-turniere',
      name: 'Hallenturniere & Wettkämpfe',
      parentId: 'folder-events',
      category: 'sonstiges',
      color: '#db2777',
      description: 'Turnierpläne, Ausschreibungen und Sponsorenübersichten',
      createdAt: now,
      updatedAt: now
    }
  ];
}
