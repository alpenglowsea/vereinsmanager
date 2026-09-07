import { ContactType, ContactPersonType, ClubContact } from '../types';

export interface ContactTypeMeta {
  id: ContactType;
  label: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  accentColor: string;
}

export const CONTACT_TYPES_LIST: ContactTypeMeta[] = [
  {
    id: 'sponsor',
    label: 'Sponsor',
    description: 'Bandenwerbung, Trikotsponsoring, Event-Sponsoren',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/60',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-200 dark:border-purple-800/60',
    accentColor: '#9333ea'
  },
  {
    id: 'donor',
    label: 'Spender',
    description: 'Geld- und Sachzuwendungen, Förderer',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-200 dark:border-rose-800/60',
    accentColor: '#e11d48'
  },
  {
    id: 'supplier',
    label: 'Lieferant',
    description: 'Sportartikel, Material, Vereinsbedarf, Kioskware',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-800 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-800/60',
    accentColor: '#d97706'
  },
  {
    id: 'service',
    label: 'Dienstleister',
    description: 'Handwerk, Reinigung, IT, Beratung, Schiedsrichter',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/60',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-200 dark:border-blue-800/60',
    accentColor: '#2563eb'
  },
  {
    id: 'association',
    label: 'Verband / Sportbund',
    description: 'Landessportbund, Fachverbände, DFB, Sportkreis',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800/60',
    accentColor: '#059669'
  },
  {
    id: 'authority',
    label: 'Kommune / Behörde',
    description: 'Stadtverwaltung, Sportamt, Finanzamt, Amtsgericht',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    badgeBorder: 'border-slate-300 dark:border-slate-700',
    accentColor: '#475569'
  },
  {
    id: 'partner',
    label: 'Kooperationspartner',
    description: 'Schulen, Kitas, Nachbarvereine, Verbünde',
    badgeBg: 'bg-cyan-50 dark:bg-cyan-950/60',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    badgeBorder: 'border-cyan-200 dark:border-cyan-800/60',
    accentColor: '#0891b2'
  },
  {
    id: 'member_contact',
    label: 'Mitgliedsbezug',
    description: 'Elternteil, Erziehungsberechtigter, Förderer',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    badgeBorder: 'border-indigo-200 dark:border-indigo-800/60',
    accentColor: '#4f46e5'
  },
  {
    id: 'other',
    label: 'Sonstige',
    description: 'Allgemeine Ansprechpartner, Medien, Presse',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800',
    badgeText: 'text-zinc-700 dark:text-zinc-300',
    badgeBorder: 'border-zinc-300 dark:border-zinc-700',
    accentColor: '#71717a'
  }
];

export const CONTACT_TYPE_MAP = new Map<ContactType, ContactTypeMeta>(
  CONTACT_TYPES_LIST.map(t => [t.id, t])
);

export function getContactTypeMeta(type: ContactType): ContactTypeMeta {
  return CONTACT_TYPE_MAP.get(type) || {
    id: type,
    label: type,
    description: '',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    badgeBorder: 'border-slate-300 dark:border-slate-700',
    accentColor: '#64748b'
  };
}

export function computeContactDisplayName(c: Partial<ClubContact>): string {
  if (c.personType === 'legal') {
    return (c.companyName || '').trim() || 'Unbenannte Firma';
  }
  const parts = [c.salutation, c.firstName, c.lastName].filter(Boolean);
  return parts.join(' ').trim() || 'Unbenannte Person';
}
