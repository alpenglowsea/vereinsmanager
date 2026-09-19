import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserPermissions } from '../types';
import {
  CloudInvitation,
  CloudUser,
  createInvitation,
  listClubUsers,
  listInvitations,
  removeClubUser,
  revokeInvitation,
  updateClubUser
} from '../services/supabaseClient';
import { AREA_DEFINITIONS, ROLE_PRESETS, canEdit, canView, permissionsFrom } from '../utils/permissions';
import { PermissionMatrix } from './PermissionMatrix';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Mail,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X
} from 'lucide-react';

/**
 * Benutzerverwaltung für den Cloud-Betrieb.
 *
 * Warum eine eigene Maske und nicht die vorhandene: Lokal steht die
 * Benutzerliste im Browser, in der Cloud in der Datenbank — und dort kann der
 * Vorstand keine fremden Konten anlegen. Der öffentliche Schlüssel darf das
 * nicht, und ein Schlüssel, der es dürfte, hätte im Browser nichts verloren.
 * Deshalb der Weg über Einladungen: Der Vorstand legt Name, Rolle und Rechte
 * fest, die Person registriert sich selbst und vergibt ihr eigenes Passwort.
 */

interface CloudUserAdminPanelProps {
  /** Kennung des angemeldeten Benutzers, damit er sich nicht selbst aussperrt. */
  currentUserId?: string;
  canManage: boolean;
  onLocked?: () => void;
}

type Notice = { type: 'success' | 'error' | 'info'; text: string } | null;

const DEFAULT_INVITE_PERMISSIONS: UserPermissions = permissionsFrom('none', { dashboard: 'view' });

export const CloudUserAdminPanel: React.FC<CloudUserAdminPanelProps> = ({
  currentUserId,
  canManage,
  onLocked
}) => {
  const [users, setUsers] = useState<CloudUser[]>([]);
  const [invitations, setInvitations] = useState<CloudInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  // Einladungsformular
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Mitarbeiter');
  const [invitePermissions, setInvitePermissions] = useState<UserPermissions>({
    ...DEFAULT_INVITE_PERMISSIONS
  });

  // Rechte eines vorhandenen Benutzers bearbeiten
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<UserPermissions>({
    ...DEFAULT_INVITE_PERMISSIONS
  });
  const [editRole, setEditRole] = useState('');

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const [u, i] = await Promise.all([listClubUsers(), listInvitations()]);
    setUsers(u);
    setInvitations(i);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const openInvitations = useMemo(
    () => invitations.filter(i => !i.acceptedAt && new Date(i.expiresAt) > new Date()),
    [invitations]
  );

  const guard = (action: () => void) => () => {
    if (canManage) action();
    else if (onLocked) onLocked();
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      if (onLocked) onLocked();
      return;
    }
    setNotice(null);

    const res = await createInvitation(
      inviteEmail.trim(),
      inviteName.trim(),
      inviteRole.trim(),
      invitePermissions
    );

    if (!res.success) {
      setNotice({ type: 'error', text: res.message || 'Einladung konnte nicht angelegt werden.' });
      return;
    }

    setNotice({
      type: 'success',
      text: `Einladung angelegt. Code: ${res.code} — geben Sie ihn ${inviteName.trim() || inviteEmail.trim()} weiter.`
    });
    setInviteOpen(false);
    setInviteName('');
    setInviteEmail('');
    setInviteRole('Mitarbeiter');
    setInvitePermissions({ ...DEFAULT_INVITE_PERMISSIONS });
    await reload();
  };

  const handleSavePermissions = async (user: CloudUser) => {
    if (!canManage) {
      if (onLocked) onLocked();
      return;
    }
    const res = await updateClubUser(user.userId, {
      permissions: editPermissions,
      roleName: editRole.trim() || user.roleName
    });
    if (!res.success) {
      setNotice({ type: 'error', text: res.message || 'Änderung fehlgeschlagen.' });
      return;
    }
    setNotice({ type: 'success', text: `Rechte von ${user.name || user.email} gespeichert.` });
    setEditingUserId(null);
    await reload();
  };

  const handleToggleActive = async (user: CloudUser) => {
    if (!canManage) {
      if (onLocked) onLocked();
      return;
    }
    if (user.userId === currentUserId && user.isActive) {
      setNotice({
        type: 'error',
        text: 'Sie können Ihren eigenen Zugang nicht sperren — sonst kommen Sie hier nicht mehr herein.'
      });
      return;
    }
    const res = await updateClubUser(user.userId, { isActive: !user.isActive });
    if (!res.success) {
      setNotice({ type: 'error', text: res.message || 'Änderung fehlgeschlagen.' });
      return;
    }
    await reload();
  };

  const handleRemove = async (user: CloudUser) => {
    if (!canManage) {
      if (onLocked) onLocked();
      return;
    }
    if (user.userId === currentUserId) {
      setNotice({ type: 'error', text: 'Den eigenen Zugang können Sie nicht entfernen.' });
      return;
    }
    const otherAdmins = users.filter(
      u => u.userId !== user.userId && u.isActive && canEdit(u.permissions, 'users')
    );
    if (canEdit(user.permissions, 'users') && otherAdmins.length === 0) {
      setNotice({
        type: 'error',
        text:
          'Das ist der einzige Zugang, der Benutzer verwalten darf. Richten Sie zuerst einen ' +
          'zweiten ein — sonst kann der Verein niemanden mehr freischalten.'
      });
      return;
    }
    if (
      !window.confirm(
        `${user.name || user.email} aus dem Verein entfernen? Das Anmeldekonto bleibt bestehen, ` +
          'der Zugriff auf die Vereinsdaten endet sofort.'
      )
    ) {
      return;
    }
    const res = await removeClubUser(user.userId);
    if (!res.success) {
      setNotice({ type: 'error', text: res.message || 'Entfernen fehlgeschlagen.' });
      return;
    }
    await reload();
  };

  const handleRevoke = async (inv: CloudInvitation) => {
    if (!canManage) {
      if (onLocked) onLocked();
      return;
    }
    const res = await revokeInvitation(inv.id);
    if (!res.success) {
      setNotice({ type: 'error', text: res.message || 'Zurückziehen fehlgeschlagen.' });
      return;
    }
    await reload();
  };

  const copyInvitationText = async (inv: CloudInvitation) => {
    const text =
      `Hallo ${inv.name || ''},\n\n` +
      `du bist als "${inv.roleName}" für die Vereinsverwaltung freigeschaltet.\n\n` +
      `So kommst du hinein:\n` +
      `1. Vereinsverwaltung öffnen und auf "Registrieren" klicken\n` +
      `2. Diese E-Mail-Adresse angeben: ${inv.email}\n` +
      `3. Ein eigenes Passwort vergeben\n` +
      `4. Diesen Einladungscode eintragen: ${inv.inviteCode}\n\n` +
      `Der Code gilt bis zum ${new Date(inv.expiresAt).toLocaleDateString('de-DE')} und nur einmal.\n`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(inv.id);
      setTimeout(() => setCopiedCode(null), 2500);
    } catch {
      setNotice({ type: 'info', text: `Einladungscode: ${inv.inviteCode}` });
    }
  };

  const areaSummary = (permissions: UserPermissions) => {
    const edit = AREA_DEFINITIONS.filter(a => canEdit(permissions, a.id)).length;
    const view = AREA_DEFINITIONS.filter(a => canView(permissions, a.id)).length;
    return `${view} von ${AREA_DEFINITIONS.length} Bereichen sichtbar, davon ${edit} bearbeitbar`;
  };

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
              Vereinsbenutzer in der Cloud
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Wer hier steht, kommt an die Vereinsdaten — und nur an die Bereiche, die
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
            onClick={guard(() => setInviteOpen(true))}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Benutzer einladen</span>
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

      {/* Einladungsformular */}
      {inviteOpen && (
        <form
          onSubmit={handleCreateInvitation}
          className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Neuen Benutzer einladen
            </h4>
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
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
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
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
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
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
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                placeholder="Schatzmeisterin"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <p className="text-2xs text-slate-500 dark:text-slate-400 leading-snug">
            Die eingeladene Person muss sich mit <strong>genau dieser</strong> E-Mail-Adresse
            registrieren und vergibt dabei ihr eigenes Passwort. Sie erfahren es nicht — das ist
            so gewollt und der Grund, warum Passwörter aus dem lokalen Betrieb nicht mitwandern.
          </p>

          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Zugriffsrechte je Menüpunkt
            </div>
            <PermissionMatrix value={invitePermissions} onChange={setInvitePermissions} />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              Einladung erstellen
            </button>
          </div>
        </form>
      )}

      {/* Offene Einladungen */}
      {openInvitations.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Offene Einladungen
          </div>
          {openInvitations.map(inv => (
            <div
              key={inv.id}
              className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Mail className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {inv.name || inv.email}
                  </span>
                  <span className="px-2 py-0.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded text-2xs font-semibold border border-amber-200 dark:border-amber-900/60">
                    {inv.roleName}
                  </span>
                </div>
                <div className="text-2xs text-slate-600 dark:text-slate-400 mt-1">
                  {inv.email} · gültig bis {new Date(inv.expiresAt).toLocaleDateString('de-DE')}
                </div>
                <div className="mt-1.5 font-mono text-sm font-bold tracking-wider text-slate-900 dark:text-white">
                  {inv.inviteCode}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => copyInvitationText(inv)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Fertigen Einladungstext in die Zwischenablage kopieren"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedCode === inv.id ? 'Kopiert' : 'Einladungstext'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRevoke(inv)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                  title="Einladung zurückziehen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Benutzerliste */}
      <div className="space-y-2">
        <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Eingetragene Benutzer
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

        {users.map(user => {
          const isSelf = user.userId === currentUserId;
          const isEditing = editingUserId === user.userId;

          return (
            <div
              key={user.userId}
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
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded text-2xs font-semibold">
                        {user.roleName}
                      </span>
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
                      setEditingUserId(isEditing ? null : user.userId);
                      setEditPermissions({ ...user.permissions });
                      setEditRole(user.roleName);
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
                  <button
                    type="button"
                    onClick={() => handleRemove(user)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                    title="Aus dem Verein entfernen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isEditing && (
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="space-y-1 sm:w-64">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Funktion im Verein
                      </label>
                      <input
                        type="text"
                        value={editRole}
                        onChange={e => setEditRole(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-2xs font-bold text-slate-400 dark:text-slate-500">
                        Vorlage:
                      </span>
                      {ROLE_PRESETS.map(preset => (
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
