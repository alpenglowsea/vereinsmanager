/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, type ReactNode } from 'react';
import { LayoutDashboard, Users, CalendarDays, Wallet, Vote, FolderArchive, Monitor, LogOut } from 'lucide-react';
import { PermissionArea } from '../types';

/**
 * Die schlanke Mobil-Ansicht für den Zugriff von unterwegs.
 * ---------------------------------------------------------------------------
 * Bewusst KEIN zweiter, unabhängiger App-Baum: Dieses Bauteil bekommt von
 * App.tsx nur die bereits geladenen Daten und die bestehende Rechteprüfung
 * (mayAccess) übergeben — dieselbe Anmeldung, dieselben Berechtigungen,
 * dieselben Daten wie die Desktop-Ansicht. Nur die Darstellung ist anders:
 * eine Tab-Leiste am unteren Bildschirmrand statt einer Seitenleiste, große
 * Tippflächen statt dichter Tabellen, keine Rechtsklick-Menüs (die gibt es
 * auf einem Touchscreen nicht).
 *
 * Jede Kachel erscheint nur, wenn die Person laut ihren Berechtigungen
 * mindestens Lesezugriff auf den jeweiligen Bereich hat — exakt dieselbe
 * Prüfung wie am Desktop, kein zweites Regelwerk.
 */
export type MobileTab = 'dashboard' | 'members' | 'calendar' | 'finance' | 'meetings' | 'documents';

interface MobileTabDefinition {
  id: MobileTab;
  area: PermissionArea;
  label: string;
  icon: typeof LayoutDashboard;
}

const MOBILE_TABS: MobileTabDefinition[] = [
  { id: 'dashboard', area: 'dashboard', label: 'Start', icon: LayoutDashboard },
  { id: 'members', area: 'members', label: 'Mitglieder', icon: Users },
  { id: 'calendar', area: 'calendar', label: 'Termine', icon: CalendarDays },
  { id: 'finance', area: 'finance', label: 'Buchung', icon: Wallet },
  { id: 'meetings', area: 'meetings', label: 'Sitzungen', icon: Vote },
  { id: 'documents', area: 'documents', label: 'Dokumente', icon: FolderArchive }
];

interface MobileShellProps {
  clubName: string;
  clubLogoUrl?: string;
  /** Darf der Benutzer diesen Bereich sehen? Identische Prüfung wie am Desktop. */
  mayAccess: (area: PermissionArea) => boolean;
  onSwitchToDesktop: () => void;
  onLogout: () => void;
  /**
   * Liefert den Inhalt für den jeweils aktiven Tab. Der zweite Parameter
   * erlaubt einem Bildschirm, gezielt zu einem anderen Tab zu wechseln (z. B.
   * eine Kachel auf dem Start-Bildschirm, die zu "Mitglieder" führt) — ohne
   * gesperrte Bereiche, die Prüfung läuft hier zentral mit.
   */
  renderTabContent: (tab: MobileTab, goToTab: (target: MobileTab) => void) => ReactNode;
}

export function MobileShell({
  clubName,
  clubLogoUrl,
  mayAccess,
  onSwitchToDesktop,
  onLogout,
  renderTabContent
}: MobileShellProps) {
  const availableTabs = MOBILE_TABS.filter(tab => mayAccess(tab.area));
  const [selectedTab, setSelectedTab] = useState<MobileTab | null>(() => availableTabs[0]?.id ?? null);

  // Falls sich die Rechte ändern (z. B. weil ein anderes Konto angemeldet
  // wurde) und der zuletzt gewählte Tab nicht mehr erlaubt ist: auf den
  // ersten weiterhin erlaubten Tab ausweichen, statt eine gesperrte Ansicht
  // stehen zu lassen.
  const activeTab =
    selectedTab && availableTabs.some(tab => tab.id === selectedTab) ? selectedTab : availableTabs[0]?.id ?? null;

  /** Wechselt den Tab, aber nur, wenn er laut Rechten überhaupt erlaubt ist. */
  const goToTab = (target: MobileTab) => {
    if (availableTabs.some(tab => tab.id === target)) {
      setSelectedTab(target);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Kopfzeile */}
      <header className="shrink-0 bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center overflow-hidden shrink-0">
            <img
              src={clubLogoUrl || '/logo_transparent.png'}
              alt={clubName || 'VereinsManager Logo'}
              className="w-full h-full object-contain"
              onError={e => {
                if (e.currentTarget.src !== window.location.origin + '/logo_transparent.png') {
                  e.currentTarget.src = '/logo_transparent.png';
                }
              }}
            />
          </div>
          <span className="text-sm font-bold truncate">{clubName || 'VereinsManager'}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onSwitchToDesktop}
            title="Zur Desktop-Ansicht wechseln"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <Monitor className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            title="Abmelden"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Inhalt des jeweils aktiven Bereichs */}
      <main className="flex-1 overflow-y-auto">
        {activeTab ? (
          renderTabContent(activeTab, goToTab)
        ) : (
          <div className="p-6 text-center text-sm text-slate-500">
            Für dieses Konto ist in der Mobil-Ansicht kein Bereich freigegeben. Wenden Sie sich an den Vorstand, wenn
            Sie hier Zugriff benötigen.
          </div>
        )}
      </main>

      {/* Tab-Leiste am unteren Bildschirmrand */}
      {availableTabs.length > 0 && (
        <nav
          className="shrink-0 bg-white border-t border-slate-200 flex items-stretch"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {availableTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-2xs font-semibold transition-colors cursor-pointer ${
                  isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/**
 * Platzhalter für einen Bereich, der in einem der nächsten Bauschritte durch
 * die tatsächliche Ansicht ersetzt wird. Bewusst freundlich formuliert statt
 * technisch ("nicht implementiert"), weil hier eine Vereinsperson steht, kein
 * Entwickler.
 */
export function MobilePlaceholderView({ label }: { label: string }) {
  return (
    <div className="p-6 flex flex-col items-center text-center gap-2 mt-12">
      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 text-xl font-bold">
        …
      </div>
      <p className="text-sm font-bold text-slate-700">{label} folgt in Kürze</p>
      <p className="text-xs text-slate-500 max-w-xs">
        Dieser Bereich der Mobil-Ansicht wird als Nächstes gebaut. Die Navigation und Berechtigungsprüfung stehen
        bereits.
      </p>
    </div>
  );
}
