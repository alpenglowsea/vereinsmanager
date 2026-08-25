import { InventoryCategory, ItemCondition } from '../types';

export interface CategoryMeta {
  id: InventoryCategory;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  iconName: string;
  examples: string;
}

export const INVENTORY_CATEGORIES: CategoryMeta[] = [
  {
    id: 'sports_equipment',
    label: 'Sportgerät',
    shortLabel: 'Sportgerät',
    description: 'Bälle, Tore, Netze, Matten, Trainingsgeräte, Turnkästen, Schläger',
    color: 'emerald',
    badgeBg: 'bg-emerald-50 border-emerald-200',
    badgeText: 'text-emerald-700',
    iconName: 'Trophy',
    examples: 'Fußbälle, Jugendtore, Tennisnetze, AirTrack-Bahn'
  },
  {
    id: 'apparel',
    label: 'Bekleidung / Trikotsätze',
    shortLabel: 'Bekleidung',
    description: 'Trikotsätze, Trainingsanzüge, Aufwärmshirts, Torwartkleidung',
    color: 'blue',
    badgeBg: 'bg-blue-50 border-blue-200',
    badgeText: 'text-blue-700',
    iconName: 'Shirt',
    examples: '1. Herren Trikotsatz ERIMA, Jugend-Aufwärmpullis'
  },
  {
    id: 'accessories',
    label: 'Zubehör & Trainingshilfen',
    shortLabel: 'Zubehör',
    description: 'Markierungsleibchen, Hütchen, Koordinationsleitern, Pfeifen, Stoppuhren',
    color: 'amber',
    badgeBg: 'bg-amber-50 border-amber-200',
    badgeText: 'text-amber-700',
    iconName: 'Boxes',
    examples: 'Leibchen-Sets, Slalomstangen, Ballpumpen'
  },
  {
    id: 'facility',
    label: 'Platz- & Hallenpflege',
    shortLabel: 'Platzpflege',
    description: 'Rasenmäher, Kreidewagen, Schleppnetze, Laubbläser, Werkzeuge',
    color: 'teal',
    badgeBg: 'bg-teal-50 border-teal-200',
    badgeText: 'text-teal-700',
    iconName: 'Wrench',
    examples: 'Aufsitz-Rasenmäher, Markierwagen, Linienbesen'
  },
  {
    id: 'electronics',
    label: 'Elektronik & IT / Audio',
    shortLabel: 'Elektronik',
    description: 'Musikanlagen, Mikrofone, Zeitmessanlagen, Laptops, Anzeigetafeln',
    color: 'indigo',
    badgeBg: 'bg-indigo-50 border-indigo-200',
    badgeText: 'text-indigo-700',
    iconName: 'Radio',
    examples: 'Mobile Soundbox JBL, Lichtschranken ALGE, Funkmikros'
  },
  {
    id: 'medical',
    label: 'Erste Hilfe & Medizin',
    shortLabel: 'Erste Hilfe',
    description: 'Defibrillator (AED), Sanitätskoffer, Eisboxen, Notfalltaschen',
    color: 'rose',
    badgeBg: 'bg-rose-50 border-rose-200',
    badgeText: 'text-rose-700',
    iconName: 'HeartPulse',
    examples: 'AED Philips HeartStart, DIN 13157 Sanikoffer'
  },
  {
    id: 'furniture',
    label: 'Vereinsheim & Mobiliar',
    shortLabel: 'Mobiliar',
    description: 'Bierzeltgarnituren, Tische, Stühle, Grillgeräte, Pavillons, Pokalschränke',
    color: 'violet',
    badgeBg: 'bg-violet-50 border-violet-200',
    badgeText: 'text-violet-700',
    iconName: 'Armchair',
    examples: '10x Bierzeltgarnituren, Faltpavillons 3x3m'
  },
  {
    id: 'other',
    label: 'Sonstiges Inventar',
    shortLabel: 'Sonstiges',
    description: 'Vereinsfahnen, Werbebanner, Pokale, Schaukästen, Schlüssel',
    color: 'slate',
    badgeBg: 'bg-slate-100 border-slate-200',
    badgeText: 'text-slate-700',
    iconName: 'Package',
    examples: 'Vereinsbanner, Festzeltbeleuchtung'
  }
];

export const CONDITION_OPTIONS: { value: ItemCondition; label: string; badgeClass: string; dotColor: string }[] = [
  { value: 'new', label: 'Neuwertig', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', dotColor: 'bg-emerald-500' },
  { value: 'good', label: 'Guter Zustand', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200', dotColor: 'bg-blue-500' },
  { value: 'used', label: 'Gebraucht / Abgenutzt', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200', dotColor: 'bg-amber-500' },
  { value: 'damaged', label: 'Beschädigt / Reparaturbedarf', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200', dotColor: 'bg-orange-500' },
  { value: 'in_repair', label: 'In Reparatur / Wartung', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200', dotColor: 'bg-purple-500' },
  { value: 'discarded', label: 'Ausgemustert / Entsorgt', badgeClass: 'bg-slate-100 text-slate-600 border-slate-300', dotColor: 'bg-slate-400' }
];

export const INVENTORY_UNITS = [
  'Stk.',
  'Set',
  'Paar',
  'Kiste / Koffer',
  'Paket (10er)',
  'Rolle',
  'Flasche / Kanister',
  'Meter'
];
