import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserPermissions } from '../types';
import {
  benutzerAnlegen,
  benutzerListe,
  berechtigungenSetzen,
  kontoAktivSetzen,
  LocalServerUser
} from '../services/localServerAuth';
import { AREA_DEFINITIONS, ROLE_PRESETS, canEdit, canView, permissionsFrom } from '../utils/permissions';
import { PermissionMatrix } from './PermissionMatrix';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  RefreshCw,
  Shield,
  Sparkles,
  UserPlus,
  Users,
  X
} from 'lucide-react';

/**
 * Benutzerverwaltung für den gehosteten Betrieb (Betriebsart 3, eigener
 * Server mit SQLite).
 *
 * Nach dem Vorbild von CloudUserAdminPanel.tsx, aber ohne den Umweg über
 * Einladungen: Hier gibt es keine externe Anmeldung, an die man sich selbst
 * registrieren könnte (siehe services/localServerAuth.ts) — der Vorstand legt
 * ein Konto direkt mit einem Anfangspasswort an, das die betroffene Person
 * bei der ersten eigenen Anmeldung ändern muss (server- und clientseitig
 * erzwungen, siehe ForcedPasswordChangeScreen.tsx). Deshalb entfällt hier
 * auch alles rund um Einladungscodes.
 *
 * Ebenfalls anders als in der Cloud: Ein Konto lässt sich hier nicht
 * entfernen, nur sperren/freigeben — der Server bietet dafür (bewusst) keine
 * Route an. Und die "Funktion im Verein" (customRoleName) lässt sich nach dem
 * Anlegen nicht mehr ändern: Die Route zum Setzen der Rechte
 * (PUT .../permissions) nimmt ausschließlich die Rechte entgegen, siehe
 * setPermissions() in server/db/repositories/localUsers.ts. Diese Maske
 * bildet deshalb bewusst kein Eingabefeld dafür nach, das ohnehin nichts
 * bewirken würde.
 */

interface LocalServerUserAdminPanelProps {
  /** Kennung des angemeldeten Benutzers, damit er sich nicht selbst aussperrt. */
  currentUserId?: string;
  canManage: boolean;
  onLocked?: () => void;
}

type Notice = { type: 'success' | 'error' | 'info'; text: string } | null;

const DEFAULT_NEW_USER_PERMISSIONS: UserPermissions = permissionsFrom('none', { dashboard: 'view' });

/**
 * Erzeugt ein zufälliges Anfangspasswort. Ohne Zeichen, die sich beim
 * Vorlesen oder Abschreiben leicht verwechseln (0/O, 1/l/I, u. Ä.) — dieses
 * Passwort muss der Vorstand oft von Hand weitergeben, nicht per Link.
 */
function erzeugeAnfangspasswort(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const werte = new Uint32Array(14);
  crypto.getRandomValues(werte);
  return Array.from(werte, (w) => alphabet[w % alphabet.length]).join('');
}

export const LocalServerUserAdminPanel: React.FC<LocalServerUserAdminPanelProps> = ({
  currentUserId,
  canManage,
  onLocked
}) => {
  const [users, setUsers] = useState<LocalServerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  // Formular: neues Konto anlegen
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createRoleName, setCreateRoleName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createPermissions, setCreatePermissions] = useState<UserPermissions>({
    ...DEFAULT_NEW_USER_PERMISSIONS
  });
  const [creating, setCreating] = useState(false);

  // Rechte eines vorhandenen Kontos bearbeiten
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<UserPermissions>({
    ...DEFAULT_NEW_USER_PERMISSIONS
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setUsers(await benutzerListe());
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const guard = (action: () => void) => () => {
    if (canManage) action();
    else if (onLocked) onLocked();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      if (onLocked) onLocked();
      return;
    }
    setNotice(null);

    if (!createName.trim()) {
      setNotice({ type: 'error', text: 'Bitte einen Namen angeben.' });
      return;
    }
    if (!createEmail.trim() || !createEmail.includes('@')) {
      setNotice({ type: 'error', text: 'Bitte eine gültige E-Mail-Adresse angeben.' });
      return;
    }
    if (!createPassword) {
      setNotice({
        type: 'error',
        text: 'Bitte ein Anfangspasswort eingeben oder über den Würfel-Knopf erzeugen lassen.'
      });
      return;
    }

    setCreating(true);
    const res = await benutzerAnlegen({
      email: createEmail.trim(),
      name: createName.trim(),
      password: createPassword,
      customRoleName: createRoleName.trim() || undefined
    });
    setCreating(false);

    if (!res.success) {
      setNotice({ type: 'error', text: res.message });
      return;
    }

    setNotice({
      type: 'success',
      text:
        `Konto für ${createName.trim()} angelegt. Das Anfangspasswort wird nirgendwo gespeichert ` +
        `und hier nicht noch einmal angezeigt — geben Sie es jetzt auf einem sicheren Weg weiter. ` +
        `${createName.trim()} muss es bei der ersten Anmeldung durch ein eigenes ersetzen.`
    });
    setCreateOpen(false);
    setCreateName('');
    setCreateEmail('');
    setCreateRoleName('');
    setCreatePassword('');
    setShowCreatePassword(false);
    setCreatePermissions({ ...DEFAULT_NEW_USER_PERMISSIONS });
    await reload();
  };

  const handleSavePermissions = async (user: LocalServerUser) => {
    if (!canManage) {
      if (onLocked) onLocked();
      return;
    }
    const res = await berechtigungenSetzen(user.id, editPermissions);
    if (!res.success) {
      setNotice({ type: 'error', text: res.message });
      return;
    }
    setNotice({ type: 'success', text: `Rechte von ${user.name || user.email} gespeichert.` });
    setEditingUserId(null);
    await reload();
  };

  const handleToggleActive = async (user: LocalServerUser) => {
    if (!canManage) {
      if (onLocked) onLocked();
      return;
    }
    if (user.id === currentUserId) {
      setNotice({
        type: 'error',
        text:
          'Sie können Ihr eigenes Konto nicht sperren — bitten Sie ein anderes Konto mit dem ' +
          'Recht "Benutzer & Rechte" darum.'
      });
      return;
    }
    if (user.isActive) {
      const otherAdmins = users.filter(
        (u) => u.id !== user.id && u.isActive && canEdit(u.permissions, 'users')
      );
      if (canEdit(user.permissions, 'users') && otherAdmins.length === 0) {
        setNotice({
          type: 'error',
          text:
            'Dieses Konto ist das letzte mit Zugriff auf die Benutzerverwaltung. Statten Sie ' +
            'zuerst ein anderes Konto mit diesem Recht aus.'
        });
        return;
      }
    }
    const res = await kontoAktivSetzen(user.id, !user.isActive);
    if (!res.success) {
      setNotice({ type: 'error', text: res.message });
      return;
    }
    await reload();
  };

  const areaSummary = (permissions: UserPermissions) => {
    const edit = AREA_DEFINITIONS.filter((a) => canEdit(permissions, a.id)).length;
    const view = AREA_DEFINITIONS.filter((a) => canView(permissions, a.id)).length;
    return `${view} von ${AREA_DEFINITIONS.length} Bereichen sichtbar, davon ${edit} bearbeitbar`;
  };

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [users]
  );

  return (
    <div className="space-y-5">
      {/* Kopf */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Benutzer auf diesem Server
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Wer hier steht, kommt an dieses Servers Vereinsdaten — und nur an die Bereiche, die
              ihm zugeteilt sind. Diese Rechte setzt der Server durch, nicht der Browser.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={reload}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Liste neu laden"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={guard(() => setCreateOpen(true))}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Konto anlegen</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs leading-snug border ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
              : notice.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                : 'bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-200'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <p className="flex-1">{notice.text}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 opacity-60 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Formular: neues Konto anlegen */}
      {createOpen && (
        <form
          onSubmit={handleCreate}
          className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Neues Konto anlegen</h4>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Name *
              </label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Sabine Weber"
                required
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                E-Mail-Adresse *
              </label>
              <input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="kasse@verein.de"
                required
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Funktion im Verein
              </label>
              <input
                type="text"
                value={createRoleName}
                onChange={(e) => setCreateRoleName(e.target.value)}
                placeholder="Schatzmeisterin"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Anfangspasswort *
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showCreatePassword ? 'text' : 'password'}
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Wird bei der ersten Anmeldung geändert"
                  autoComplete="new-password"
                  required
                  className="w-full pl-3 pr-9 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showCreatePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreatePassword(erzeugeAnfangspasswort());
                  setShowCreatePassword(true);
                }}
                title="Zufälliges Anfangspasswort erzeugen"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Erzeugen</span>
              </button>
            </div>
          </div>

          <p className="flex items-start gap-2 text-2xs text-slate-500 dark:text-slate-400 leading-snug">
            <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Dieses Passwort merkt sich der Server nur verschlüsselt — geben Sie es der Person
              persönlich, telefonisch oder auf einem anderen sicheren Weg weiter, nie per unverschlüsselter
              E-Mail. Beim ersten Anmelden muss es sofort durch ein eigenes ersetzt werden.
            </span>
          </p>

          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Zugriffsrechte je Menüpunkt
            </div>
            <PermissionMatrix value={createPermissions} onChange={setCreatePermissions} />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {creating ? 'Wird angelegt …' : 'Konto anlegen'}
            </button>
          </div>
        </form>
      )}

      {/* Benutzerliste */}
      <div className="space-y-2">
        <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Eingetragene Konten
        </div>

        {loading && users.length === 0 && (
          <div className="text-xs text-slate-500 dark:text-slate-400 p-4">Wird geladen …</div>
        )}

        {!loading && users.length === 0 && (
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Hier ist noch niemand eingetragen. Falls Sie gerade selbst angemeldet sind und diese
            Liste leer bleibt, fehlt Ihrem Zugang das Recht, Benutzer einzusehen.
          </div>
        )}

        {sortedUsers.map((user) => {
          const isSelf = user.id === currentUserId;
          const isEditing = editingUserId === user.id;

          return (
            <div
              key={user.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                      canEdit(user.permissions, 'users')
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        : canEdit(user.permissions, 'finance')
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    }`}
                  >
                    {(user.name || user.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {user.name || user.email}
                      </span>
                      {user.customRoleName && (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded text-2xs font-semibold">
                          {user.customRoleName}
                        </span>
                      )}
                      {isSelf && (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 rounded text-2xs font-bold">
                          Sie
                        </span>
                      )}
                      {!user.isActive && (
                        <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 rounded text-2xs font-bold">
                          Gesperrt
                        </span>
                      )}
                      {user.mustChangePassword && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded text-2xs font-bold"
                          title="Noch mit dem Anfangspasswort — muss es bei der nächsten Anmeldung ändern"
                        >
                          <Lock className="w-2.5 h-2.5" />
                          <span>Anfangspasswort</span>
                        </span>
                      )}
                    </div>
                    <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {user.email}
                    </div>
                    <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                      {areaSummary(user.permissions)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={guard(() => {
                      setEditingUserId(isEditing ? null : user.id);
                      setEditPermissions({ ...user.permissions });
                    })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>{isEditing ? 'Schliessen' : 'Rechte'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(user)}
                    className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {user.isActive ? 'Sperren' : 'Freigeben'}
                  </button>
                </div>
              </div>

              {isEditing && (
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-2xs font-bold text-slate-400 dark:text-slate-500">
                      Vorlage:
                    </span>
                    {ROLE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.description}
                        onClick={() => setEditPermissions({ ...preset.permissions })}
                        className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-2xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <PermissionMatrix
                    value={editPermissions}
                    onChange={setEditPermissions}
                    showPresets={false}
                  />

                  <div className="flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setEditingUserId(null)}
                      className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSavePermissions(user)}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                    >
                      Rechte speichern
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
