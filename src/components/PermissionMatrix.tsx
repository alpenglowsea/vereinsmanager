import React from 'react';
import { AccessLevel, PermissionArea, UserPermissions } from '../types';
import { AREA_DEFINITIONS, ROLE_PRESETS, isViewOnlyArea } from '../utils/permissions';

/**
 * Rechtemaske: je Navigationsbereich eine Stufe.
 *
 * Bewusst an einer Stelle für Einstellungen und Benutzerverwaltung, damit
 * beide Masken dieselben Bereiche anbieten. Zwei Kopien würden auseinander
 * laufen, sobald ein Menüpunkt hinzukommt.
 */

/** Reihenfolge der Überschriften, abgeleitet aus den Bereichsdefinitionen. */
export const AREA_GROUPS: string[] = AREA_DEFINITIONS.reduce<string[]>((acc, a) => {
  if (!acc.includes(a.group)) acc.push(a.group);
  return acc;
}, []);

export const LEVEL_OPTIONS: { value: AccessLevel; label: string; hint: string }[] = [
  { value: 'none', label: 'Gesperrt', hint: 'Menüpunkt wird ausgeblendet' },
  { value: 'view', label: 'Ansehen', hint: 'Darf öffnen, aber nichts ändern' },
  { value: 'edit', label: 'Bearbeiten', hint: 'Darf anlegen, ändern und löschen' }
];

interface PermissionMatrixProps {
  value: UserPermissions;
  onChange: (next: UserPermissions) => void;
  /** Schnellwahl-Knöpfe über der Maske anzeigen. */
  showPresets?: boolean;
}

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  value,
  onChange,
  showPresets = true
}) => {
  const setAreaLevel = (area: PermissionArea, level: AccessLevel) => {
    onChange({
      ...value,
      // Auswertungsbereiche kennen kein "Bearbeiten".
      [area]: isViewOnlyArea(area) && level === 'edit' ? 'view' : level
    });
  };

  const setGroupLevel = (group: string, level: AccessLevel) => {
    const next = { ...value };
    AREA_DEFINITIONS.filter(a => a.group === group).forEach(a => {
      next[a.id] = isViewOnlyArea(a.id) && level === 'edit' ? 'view' : level;
    });
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {showPresets && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-2xs font-bold text-slate-400 dark:text-slate-500 mr-1">
            Vorlage:
          </span>
          {ROLE_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              onClick={() => onChange({ ...preset.permissions })}
              className={`px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-2xs font-bold transition-colors cursor-pointer ${
                preset.id === 'none'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {AREA_GROUPS.map(group => {
        const areas = AREA_DEFINITIONS.filter(a => a.group === group);
        return (
          <div
            key={group}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-2xs overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/60">
              <div className="text-2xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {group}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-2xs text-slate-400 dark:text-slate-500 font-semibold mr-0.5">
                  Alle:
                </span>
                {LEVEL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGroupLevel(group, opt.value)}
                    className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-2xs font-semibold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {areas.map(area => {
                const level: AccessLevel = value[area.id] || 'none';
                const viewOnly = isViewOnlyArea(area.id);
                return (
                  <div
                    key={area.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                        {area.label}
                      </div>
                      <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {area.description}
                        {viewOnly && ' — reine Auswertung, nichts zu bearbeiten'}
                      </div>
                    </div>

                    <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 self-start sm:self-auto">
                      {LEVEL_OPTIONS.filter(opt => !(viewOnly && opt.value === 'edit')).map(opt => {
                        const active = level === opt.value;
                        const activeClass =
                          opt.value === 'none'
                            ? 'bg-slate-600 text-white'
                            : opt.value === 'view'
                              ? 'bg-amber-500 text-white'
                              : 'bg-emerald-600 text-white';
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            title={opt.hint}
                            aria-pressed={active}
                            onClick={() => setAreaLevel(area.id, opt.value)}
                            className={`px-2.5 py-1.5 text-2xs font-bold transition-colors cursor-pointer border-r border-slate-200 dark:border-slate-700 last:border-r-0 ${
                              active
                                ? activeClass
                                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="text-2xs text-slate-600 dark:text-amber-200/80 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-lg p-2.5 leading-snug">
        <strong>Hinweis:</strong> Diese Rechte steuern, was in dieser Anwendung angezeigt und
        bedient werden kann. Im Cloud-Betrieb muss der Zugriff zusätzlich in Supabase
        abgesichert werden — sonst schützt die Einstellung nur die Bedienoberfläche.
      </p>
    </div>
  );
};
