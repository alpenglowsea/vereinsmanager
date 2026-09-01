export type DashboardWidgetCategory =
  | 'overview'
  | 'members'
  | 'finance'
  | 'calendar'
  | 'inventory'
  | 'documents';

export type WidgetColSpan = 1 | 2 | 3 | 4;

export interface DashboardWidgetConfig {
  id: string;
  enabled: boolean;
  order: number;
  colSpan: WidgetColSpan;
}

export interface DashboardWidgetDefinition {
  id: string;
  title: string;
  shortTitle?: string;
  description: string;
  category: DashboardWidgetCategory;
  categoryLabel: string;
  iconName: string;
  defaultColSpan: WidgetColSpan;
  minColSpan: WidgetColSpan;
  maxColSpan: WidgetColSpan;
  defaultEnabled: boolean;
  defaultOrder: number;
  tags: string[];
}

export interface UserDashboardConfig {
  version: number;
  widgets: DashboardWidgetConfig[];
  updatedAt?: string;
}

export type DashboardPreset = 'default' | 'finance' | 'members' | 'compact' | 'all';
