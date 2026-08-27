import { CalendarEvent, CalendarEventCategory } from '../types';

export const DEFAULT_CALENDAR_CATEGORIES: CalendarEventCategory[] = [
  {
    id: 'cat-match',
    name: 'Spiel & Wettkampf',
    color: '#ef4444',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800',
    badgeBorder: 'border-rose-300',
    icon: 'Trophy',
    description: 'Punktspiele, Turniere, Pokalspiele und Meisterschaften',
    isSystem: true
  },
  {
    id: 'cat-training',
    name: 'Training & Kurse',
    color: '#10b981',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
    icon: 'Activity',
    description: 'Reguläre Trainingseinheiten, Übungsstunden und Fitnesskurse',
    isSystem: true
  },
  {
    id: 'cat-assembly',
    name: 'Mitgliederversammlung / JHV',
    color: '#2563eb',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    badgeBorder: 'border-blue-300',
    icon: 'Landmark',
    description: 'Ordentliche und außerordentliche Jahreshauptversammlungen',
    isSystem: true
  },
  {
    id: 'cat-board',
    name: 'Vorstandssitzung & Gremien',
    color: '#7c3aed',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-300',
    icon: 'Users',
    description: 'Monatliche Vorstandssitzungen, Abteilungsleiter-Treffen und Ausschüsse',
    isSystem: true
  },
  {
    id: 'cat-celebration',
    name: 'Vereinsfest & Event',
    color: '#f59e0b',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-300',
    icon: 'PartyPopper',
    description: 'Sommerfeste, Jubiläen, Weihnachtsfeiern und Vereinsmeisterschaften',
    isSystem: true
  },
  {
    id: 'cat-maintenance',
    name: 'Arbeitseinsatz & Pflege',
    color: '#ea580c',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-800',
    badgeBorder: 'border-orange-300',
    icon: 'Wrench',
    description: 'Platzpflege, Hallenreinigung, Reparaturen und Geländearbeiten',
    isSystem: true
  },
  {
    id: 'cat-course',
    name: 'Lehrgang & Fortbildung',
    color: '#0891b2',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-800',
    badgeBorder: 'border-cyan-300',
    icon: 'GraduationCap',
    description: 'Trainerscheine, Schiedsrichterlehrgänge und Erste-Hilfe-Kurse',
    isSystem: true
  },
  {
    id: 'cat-general',
    name: 'Allgemeiner Termin',
    color: '#64748b',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    badgeBorder: 'border-slate-300',
    icon: 'Calendar',
    description: 'Sonstige Vereinstermine, Fristen und Ankündigungen',
    isSystem: true
  }
];

export const INITIAL_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'evt-1',
    title: 'Jahreshauptversammlung 2026',
    description: 'Ordentliche Mitgliederversammlung mit Berichten des Vorstands, Entlastung, Ehrungen langjähriger Mitglieder und Neuwahl des Kassenprüfers. Im Anschluss gemütliches Beisammensein.',
    categoryId: 'cat-assembly',
    department: 'all',
    startDate: '2026-09-18',
    startTime: '19:00',
    endDate: '2026-09-18',
    endTime: '22:00',
    isAllDay: false,
    location: 'Vereinsheim TSV Musterstadt, Sportplatzweg 12, 12345 Musterstadt',
    locationLat: 52.520008,
    locationLng: 13.404954,
    participants: [
      {
        memberId: 'mem-1',
        memberName: 'Dr. Michael Sommer',
        memberEmail: 'sommer@tsv-musterstadt.de',
        memberDepartment: 'Vorstand',
        role: 'organizer',
        status: 'confirmed',
        notes: 'Versammlungsleitung'
      },
      {
        memberId: 'mem-2',
        memberName: 'Sabine Weber',
        memberEmail: 'weber@tsv-musterstadt.de',
        memberDepartment: 'Finanzen',
        role: 'organizer',
        status: 'confirmed',
        notes: 'Kassenbericht 2025/2026'
      },
      {
        memberId: 'mem-3',
        memberName: 'Klaus Meier',
        memberEmail: 'meier@tsv-musterstadt.de',
        memberDepartment: 'Fußball',
        role: 'organizer',
        status: 'confirmed',
        notes: 'Bericht Kassenprüfung'
      },
      {
        memberId: 'mem-4',
        memberName: 'Laura Schmidt',
        memberEmail: 'laura.s@example.com',
        memberDepartment: 'Turnen',
        role: 'participant',
        status: 'confirmed'
      },
      {
        memberId: 'mem-5',
        memberName: 'Thomas Bauer',
        memberEmail: 'thomas.bauer@muster.de',
        memberDepartment: 'Tennis',
        role: 'participant',
        status: 'invited'
      }
    ],
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-01-10T10:00:00.000Z'
  },
  {
    id: 'evt-2',
    title: 'Wöchentliches Jugendtraining Fußball',
    description: 'Gemeinsames Technik- und Koordinationstraining der C- und B-Jugend. Bitte Trainingskleidung, Schienbeinschoner und Trinkflasche mitbringen.',
    categoryId: 'cat-training',
    department: 'Fußball',
    startDate: '2026-08-04',
    startTime: '17:30',
    endDate: '2026-08-04',
    endTime: '19:00',
    isAllDay: false,
    location: 'Hauptplatz Sportanlage, Sportplatzweg 12, 12345 Musterstadt',
    locationLat: 52.520008,
    locationLng: 13.404954,
    recurrence: {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [2, 4], // Tuesday (2) and Thursday (4)
      endType: 'never'
    },
    participants: [
      {
        memberId: 'mem-3',
        memberName: 'Klaus Meier',
        memberEmail: 'meier@tsv-musterstadt.de',
        memberDepartment: 'Fußball',
        role: 'trainer',
        status: 'confirmed',
        notes: 'Haupttrainer'
      },
      {
        memberId: 'mem-7',
        memberName: 'Felix Becker',
        memberDepartment: 'Fußball',
        role: 'participant',
        status: 'confirmed'
      },
      {
        memberId: 'mem-8',
        memberName: 'Maximilian Müller',
        memberDepartment: 'Fußball',
        role: 'participant',
        status: 'confirmed'
      }
    ],
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'evt-3',
    title: 'Monatliche Vorstandssitzung',
    description: 'Reguläre Beratung über Vereinsfinanzen, Anträge der Abteilungen, Investitionen und anstehende Veranstaltungen.',
    categoryId: 'cat-board',
    department: 'Vorstand',
    startDate: '2026-08-03',
    startTime: '19:30',
    endDate: '2026-08-03',
    endTime: '21:30',
    isAllDay: false,
    location: 'Sitzungszimmer Vereinsheim, Sportplatzweg 12, 12345 Musterstadt',
    locationLat: 52.520008,
    locationLng: 13.404954,
    recurrence: {
      frequency: 'monthly',
      interval: 1,
      endType: 'never'
    },
    participants: [
      {
        memberId: 'mem-1',
        memberName: 'Dr. Michael Sommer',
        memberEmail: 'sommer@tsv-musterstadt.de',
        memberDepartment: 'Vorstand',
        role: 'organizer',
        status: 'confirmed'
      },
      {
        memberId: 'mem-2',
        memberName: 'Sabine Weber',
        memberEmail: 'weber@tsv-musterstadt.de',
        memberDepartment: 'Finanzen',
        role: 'organizer',
        status: 'confirmed'
      }
    ],
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'evt-4',
    title: 'Heimspiel 1. Herren vs. FC Nordstern',
    description: 'Spitzenspiel der Bezirksliga! Für Verpflegung mit Grill und Kaltgetränken am Sportlerheim ist gesorgt. Eintritt für Mitglieder frei.',
    categoryId: 'cat-match',
    department: 'Fußball',
    startDate: '2026-08-29',
    startTime: '15:00',
    endDate: '2026-08-29',
    endTime: '17:00',
    isAllDay: false,
    location: 'Stadion am Sportplatzweg, 12345 Musterstadt',
    locationLat: 52.520008,
    locationLng: 13.404954,
    participants: [
      {
        memberId: 'mem-3',
        memberName: 'Klaus Meier',
        memberDepartment: 'Fußball',
        role: 'organizer',
        status: 'confirmed'
      },
      {
        memberId: 'mem-6',
        memberName: 'Christian Koch',
        memberDepartment: 'Fußball',
        role: 'helper',
        status: 'confirmed',
        notes: 'Stadiondurchsage & Grilldienst'
      }
    ],
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z'
  },
  {
    id: 'evt-5',
    title: 'TSV Sommerfest & Tag der offenen Tür',
    description: 'Großes Familienfest mit Schnupperstationen aller Abteilungen (Fußball, Turnen, Tennis, Schwimmen), Hüpfburg, Tombola und Live-Musik ab 19 Uhr.',
    categoryId: 'cat-celebration',
    department: 'all',
    startDate: '2026-08-15',
    endDate: '2026-08-15',
    isAllDay: true,
    location: 'Gesamtes Vereinsgelände & Festwiese, Sportplatzweg 12, 12345 Musterstadt',
    locationLat: 52.520008,
    locationLng: 13.404954,
    participants: [
      {
        memberId: 'mem-1',
        memberName: 'Dr. Michael Sommer',
        memberDepartment: 'Vorstand',
        role: 'organizer',
        status: 'confirmed'
      },
      {
        memberId: 'mem-4',
        memberName: 'Laura Schmidt',
        memberDepartment: 'Turnen',
        role: 'helper',
        status: 'confirmed',
        notes: 'Kinderparcours Betreuung'
      }
    ],
    createdAt: '2026-05-01T12:00:00.000Z',
    updatedAt: '2026-05-01T12:00:00.000Z'
  },
  {
    id: 'evt-6',
    title: 'Herbst-Arbeitseinsatz & Platzinstandsetzung',
    description: 'Gemeinsame Platzpflege, Netzausbesserung, Heckenrückschnitt und Hallenreinigung vor Beginn der Wintersaison. Jede helfende Hand ist willkommen! Im Anschluss Helferbrotzeit.',
    categoryId: 'cat-maintenance',
    department: 'all',
    startDate: '2026-10-10',
    startTime: '09:00',
    endDate: '2026-10-10',
    endTime: '13:30',
    isAllDay: false,
    location: 'Sportgelände TSV Musterstadt, Sportplatzweg 12, 12345 Musterstadt',
    locationLat: 52.520008,
    locationLng: 13.404954,
    participants: [
      {
        memberId: 'mem-2',
        memberName: 'Sabine Weber',
        memberDepartment: 'Finanzen',
        role: 'organizer',
        status: 'confirmed',
        notes: 'Organisation Verpflegung'
      },
      {
        memberId: 'mem-6',
        memberName: 'Christian Koch',
        memberDepartment: 'Fußball',
        role: 'helper',
        status: 'confirmed',
        notes: 'Geräteausgabe & Werkzeuge'
      }
    ],
    createdAt: '2026-08-01T11:00:00.000Z',
    updatedAt: '2026-08-01T11:00:00.000Z'
  },
  {
    id: 'evt-7',
    title: 'Erste-Hilfe-Schulung & Sportunfall-Prävention',
    description: 'Offizieller Auffrischungskurs für Trainer, Übungsleiter und Betreuer mit Zertifikat. Themen: Herz-Lungen-Wiederbelebung, AED-Einsatz, Sportverletzungen und Notfallkette.',
    categoryId: 'cat-course',
    department: 'all',
    startDate: '2026-10-24',
    startTime: '09:30',
    endDate: '2026-10-24',
    endTime: '16:00',
    isAllDay: false,
    location: 'Schulungsraum Vereinsheim, Sportplatzweg 12, 12345 Musterstadt',
    locationLat: 52.520008,
    locationLng: 13.404954,
    participants: [
      {
        memberId: 'mem-4',
        memberName: 'Laura Schmidt',
        memberDepartment: 'Turnen',
        role: 'participant',
        status: 'confirmed'
      },
      {
        memberId: 'mem-5',
        memberName: 'Thomas Bauer',
        memberDepartment: 'Tennis',
        role: 'participant',
        status: 'confirmed'
      }
    ],
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z'
  }
];
