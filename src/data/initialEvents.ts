import { CalendarEventCategory } from '../types';

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
