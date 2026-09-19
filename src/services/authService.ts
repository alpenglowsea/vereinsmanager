import { AppUser, PermissionArea, SecuritySettings, UserAuthSession } from '../types';
import { FULL_PERMISSIONS, INITIAL_USERS, DEFAULT_SECURITY_SETTINGS } from '../data/roles';
import { canEdit, canView, migrateLegacyPermissions } from '../utils/permissions';
import { checkPasswordStrength, hashPassword, isHashed, verifyPassword } from './passwordService';
import {
  acceptInvitation,
  claimFirstAdmin,
  fetchClubUser,
  getSupabaseClient,
  isCloudModeActive,
  isCloudSetupPending
} from './supabaseClient';

const STORAGE_KEY_USERS = 'vm_users_v2';
const STORAGE_KEY_SECURITY = 'vm_security_settings_v2';
const STORAGE_KEY_CURRENT_SESSION = 'vm_auth_session_v2';
const STORAGE_KEY_SETUP = 'vm_cloud_setup_pending';

/**
 * Ergänzt Berechtigungen, die es zum Zeitpunkt der Speicherung noch nicht gab.
 *
 * Fehlende Felder werden als ERLAUBT gewertet, nicht als verboten: Wer gestern
 * Zugriff auf die Kontakte hatte, darf ihn durch ein Programm-Update nicht
 * verlieren. Der Vorstand kann jederzeit nachträglich einschränken — ein
 * stillschweigendes Aussperren könnte er dagegen nicht einmal erklären.
 */
function withDefaultPermissions(user: AppUser): AppUser {
  return { ...user, permissions: migrateLegacyPermissions(user.permissions) };
}

export class AuthService {
  private static cachedUsers: AppUser[] | null = null;
  private static cachedSecurity: SecuritySettings | null = null;
  private static currentSession: UserAuthSession | null = null;
  private static listeners: Array<(session: UserAuthSession) => void> = [];
  private static inactivityTimer: any = null;

  // Initialize Auth Service
  public static async init(): Promise<UserAuthSession> {
    const sec = this.getSecuritySettings();

    // Ensure users exist
    const users = this.getUsers();
    if (users.length === 0) {
      this.saveUsers(INITIAL_USERS);
    }

    // Klartext-Passwörter aus der Zeit vor dieser Umstellung ersetzen.
    // Das passiert einmalig und unbemerkt; die Anmeldung funktioniert danach
    // unverändert weiter, nur steht im Speicher kein lesbares Passwort mehr.
    await this.upgradeStoredPasswords();

    // Check stored session
    const storedSession = localStorage.getItem(STORAGE_KEY_CURRENT_SESSION) || sessionStorage.getItem(STORAGE_KEY_CURRENT_SESSION);
    if (storedSession) {
      try {
        const parsed: UserAuthSession = JSON.parse(storedSession);
        
        // Auto-lock inactivity check
        if (sec.authRequired && sec.autoLockMinutes > 0 && parsed.isAuthenticated) {
          const lastActivity = Number(localStorage.getItem('vm_last_activity') || Date.now());
          const maxInactivityMs = sec.autoLockMinutes * 60 * 1000;
          if (Date.now() - lastActivity > maxInactivityMs) {
            this.currentSession = { user: null, isAuthenticated: false };
            this.persistSession(this.currentSession);
            return this.currentSession;
          }
        }

        // Verify user still exists and is active
        if (parsed.user) {
          const currentFreshUser = this.getUsers().find(u => u.id === parsed.user?.id);
          if (currentFreshUser && currentFreshUser.isActive) {
            this.currentSession = {
              ...parsed,
              user: currentFreshUser
            };
          } else {
            this.currentSession = { user: null, isAuthenticated: false };
          }
        } else {
          this.currentSession = parsed;
        }

        this.startInactivityTracker();
        return this.currentSession;
      } catch {
        // ignore
      }
    }

    // Default session if auth not required:
    if (!sec.authRequired) {
      const allUsers = this.getUsers();
      this.currentSession = {
        user: allUsers[0] || INITIAL_USERS[0],
        isAuthenticated: true,
        loginTime: new Date().toISOString()
      };
    } else {
      this.currentSession = {
        user: null,
        isAuthenticated: false
      };
    }

    this.persistSession(this.currentSession);
    return this.currentSession;
  }

  // Session Listeners
  public static onAuthStateChanged(callback: (session: UserAuthSession) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private static notifyListeners() {
    if (this.currentSession) {
      this.listeners.forEach(cb => cb(this.currentSession!));
    }
  }

  // Activity Tracker for Auto-Lock
  public static recordActivity() {
    localStorage.setItem('vm_last_activity', String(Date.now()));
  }

  public static startInactivityTracker() {
    if (this.inactivityTimer) {
      clearInterval(this.inactivityTimer);
    }

    this.recordActivity();

    this.inactivityTimer = setInterval(() => {
      const sec = this.getSecuritySettings();
      if (!sec.authRequired || sec.autoLockMinutes <= 0) return;
      if (!this.currentSession?.isAuthenticated) return;

      const lastActivity = Number(localStorage.getItem('vm_last_activity') || Date.now());
      const maxInactivityMs = sec.autoLockMinutes * 60 * 1000;

      if (Date.now() - lastActivity > maxInactivityMs) {
        this.lockSession();
      }
    }, 30000);
  }

  // Get current active session
  public static getSession(): UserAuthSession {
    if (!this.currentSession) {
      const stored = localStorage.getItem(STORAGE_KEY_CURRENT_SESSION);
      if (stored) {
        try {
          this.currentSession = JSON.parse(stored);
        } catch {
          this.currentSession = { user: null, isAuthenticated: false };
        }
      } else {
        this.currentSession = { user: null, isAuthenticated: false };
      }
    }
    return this.currentSession;
  }

  public static getCurrentUser(): AppUser | null {
    return this.getSession().user;
  }

  // Helper to check if current session is isolated Demo Mode
  public static isDemoMode(): boolean {
    const session = this.getSession();
    return Boolean(session?.isAuthenticated && session?.loginMethod === 'demo');
  }

  // ==========================================
  // LOGIN / LOGOUT / REGISTER
  // ==========================================

  // Register New Club Administrator Account across all 3 modes
  public static async register(params: {
    clubName: string;
    name: string;
    email: string;
    username: string;
    password: string;
    customRoleName?: string;
    /** Nur im Cloud-Betrieb: der Code aus dem SQL-Skript. */
    setupCode?: string;
  }): Promise<{ success: boolean; message?: string; user?: AppUser; requiresEmailConfirmation?: boolean }> {
    const clubName = params.clubName.trim();
    const name = params.name.trim();
    const email = params.email.trim().toLowerCase();
    const username = params.username.trim().toLowerCase();
    const password = params.password.trim();

    if (!clubName) {
      return { success: false, message: 'Bitte geben Sie einen Vereinsnamen ein.' };
    }
    if (!name) {
      return { success: false, message: 'Bitte Ihren Namen (Vorstand / Ansprechpartner) eingeben.' };
    }
    if (!email || !email.includes('@')) {
      return { success: false, message: 'Bitte eine gültige E-Mail-Adresse eingeben.' };
    }
    if (!username || username.length < 3) {
      return { success: false, message: 'Der Benutzername muss mindestens 3 Zeichen lang sein.' };
    }
    const strength = checkPasswordStrength(password);
    if (!strength.ok) {
      return { success: false, message: strength.message };
    }

    // Im Cloud-Betrieb ist die Registrierung etwas anderes als lokal: Sie legt
    // ein echtes Supabase-Konto an und trägt den Vorstand als ersten Benutzer
    // in die Vereinsdatenbank ein. Schlägt das fehl, darf sie NICHT still auf
    // einen lokalen Benutzer ausweichen — sonst stünde jemand mit einem
    // Konto da, das in der Cloud nichts darf.
    if (isCloudModeActive()) {
      return this.registerCloud({
        clubName,
        name,
        email,
        username,
        password,
        setupCode: params.setupCode || '',
        customRoleName: params.customRoleName
      });
    }

    const users = this.getUsers();
    if (users.some(u => u.username.toLowerCase() === username)) {
      return { success: false, message: `Der Benutzername "${username}" ist bereits vergeben.` };
    }
    if (users.some(u => u.email.toLowerCase() === email)) {
      return { success: false, message: `Die E-Mail-Adresse "${email}" ist bereits registriert.` };
    }

    // Try Supabase Auth if Supabase client is configured
    let requiresEmailConfirmation = false;
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              username,
              club_name: clubName,
              role: 'Vorstand'
            }
          }
        });
        if (error) {
          console.warn('Supabase Cloud Sign-Up Meldung:', error.message);
        } else if (data?.user && !data?.session) {
          requiresEmailConfirmation = true;
        }
      } catch (sbErr) {
        console.warn('Supabase Auth error:', sbErr);
      }
    }

    // Create new Admin User with full permissions
    const newUser: AppUser = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      username,
      email,
      name,
      password: await hashPassword(password),
      customRoleName: params.customRoleName || '1. Vorsitzender (Admin)',
      permissions: { ...FULL_PERMISSIONS },
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

    // Save to users list
    this.saveUser(newUser);

    // Switch to live session
    this.currentSession = {
      user: newUser,
      isAuthenticated: true,
      loginMethod: sb && !requiresEmailConfirmation ? 'supabase' : 'user',
      loginTime: new Date().toISOString()
    };

    this.persistSession(this.currentSession);
    this.startInactivityTracker();
    this.notifyListeners();

    return {
      success: true,
      user: newUser,
      requiresEmailConfirmation,
      message: requiresEmailConfirmation
        ? 'Vereinskonto erstellt! Bitte prüfen Sie Ihre E-Mails für die Supabase-Aktivierung.'
        : 'Vereinskonto erfolgreich erstellt!'
    };
  }

  /**
   * Registrierung im Cloud-Betrieb.
   *
   * Zwei Fälle, die sich für den Anwender gleich anfühlen sollen: Entweder
   * richtet jemand den Verein neu ein — dann gilt der Einrichtungscode aus
   * dem SQL-Skript — oder er wurde vom Vorstand eingeladen und hat einen
   * Einladungscode. Welcher Fall vorliegt, entscheidet die Datenbank, nicht
   * der Anwender: Solange noch kein Benutzer eingetragen ist, ist es der
   * erste; danach kann es nur eine Einladung sein.
   */
  private static async registerCloud(params: {
    clubName: string;
    name: string;
    email: string;
    username: string;
    password: string;
    setupCode: string;
    customRoleName?: string;
  }): Promise<{ success: boolean; message?: string; user?: AppUser; requiresEmailConfirmation?: boolean }> {
    const sb = getSupabaseClient();
    if (!sb) {
      return { success: false, message: 'Die Cloud-Datenbank ist nicht erreichbar.' };
    }

    const code = params.setupCode.trim();
    if (!code) {
      return {
        success: false,
        message:
          'Bitte den Code eingeben — entweder den Einrichtungscode aus dem SQL-Skript ' +
          'oder den Einladungscode, den Ihnen der Vorstand gegeben hat.'
      };
    }

    const isFirstAdmin = await isCloudSetupPending();

    const { data, error } = await sb.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: { name: params.name, username: params.username, club_name: params.clubName }
      }
    });

    if (error) {
      return { success: false, message: `Konto konnte nicht angelegt werden: ${error.message}` };
    }

    // Ohne Sitzung verlangt Supabase eine E-Mail-Bestätigung. Der Eintrag in
    // die Vereinsdatenbank wird dann bei der ersten Anmeldung nachgeholt.
    if (!data.session) {
      this.rememberSetupCode(code, params.name, params.customRoleName, isFirstAdmin ? 'setup' : 'invite');
      return {
        success: false,
        requiresEmailConfirmation: true,
        message:
          'Konto angelegt. Bitte bestätigen Sie jetzt die E-Mail von Supabase und melden ' +
          'Sie sich anschliessend hier an — die Freischaltung wird dann abgeschlossen.'
      };
    }

    const entry = isFirstAdmin
      ? await claimFirstAdmin(code, params.name, params.customRoleName || '1. Vorsitzende(r)')
      : await acceptInvitation(code);

    if (!entry.success) {
      return { success: false, message: entry.message };
    }

    this.forgetSetupCode();
    const loginRes = await this.loginWithSupabase(params.email, params.password);
    if (!loginRes.success) {
      return { success: false, message: loginRes.message };
    }

    return {
      success: true,
      user: this.currentSession?.user || undefined,
      message: isFirstAdmin
        ? 'Vereinskonto erstellt und als Vorstand eingetragen.'
        : 'Konto erstellt und für den Verein freigeschaltet.'
    };
  }

  /**
   * Einrichtungscode zwischenspeichern, solange die E-Mail-Bestätigung
   * aussteht. Er ist nur einmal gültig und wird nach dem Eintragen gelöscht.
   */
  private static rememberSetupCode(
    code: string,
    name: string,
    roleLabel?: string,
    kind: 'setup' | 'invite' = 'setup'
  ) {
    try {
      localStorage.setItem(
        STORAGE_KEY_SETUP,
        JSON.stringify({ code, name, roleLabel: roleLabel || '1. Vorsitzende(r)', kind })
      );
    } catch {
      // Ohne Zwischenspeicher muss der Code nach der Bestätigung erneut
      // eingegeben werden — kein Grund, die Registrierung abzubrechen.
    }
  }

  private static forgetSetupCode() {
    try {
      localStorage.removeItem(STORAGE_KEY_SETUP);
    } catch {
      // nichts zu tun
    }
  }

  private static readSetupCode(): {
    code: string;
    name: string;
    roleLabel: string;
    kind?: 'setup' | 'invite';
  } | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETUP);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // Standard Login with Username / Email and Password
  public static async login(usernameOrEmail: string, password: string): Promise<{ success: boolean; message?: string; user?: AppUser }> {
    const term = usernameOrEmail.trim().toLowerCase();
    const pass = password.trim();

    if (!term || !pass) {
      return { success: false, message: 'Bitte Benutzername und Passwort eingeben.' };
    }

    // Im Cloud-Betrieb entscheidet die Datenbank, nicht die lokale Liste.
    //
    // Das ist keine Feinheit: Die Zugriffsregeln des Servers kennen nur
    // Supabase-Konten. Eine Anmeldung gegen die lokale Liste würde zwar die
    // Oberfläche öffnen, aber jede Abfrage an die Datenbank liefe ohne
    // Anmeldung — und käme seit der Absicherung leer zurück.
    if (isCloudModeActive()) {
      if (!term.includes('@')) {
        return {
          success: false,
          message: 'Im Cloud-Betrieb melden Sie sich mit Ihrer E-Mail-Adresse an.'
        };
      }
      const cloudRes = await this.loginWithSupabase(term, pass);
      if (!cloudRes.success) {
        return { success: false, message: cloudRes.message };
      }
      return { success: true, user: this.currentSession?.user || undefined };
    }

    const users = this.getUsers();
    const user = users.find(u => 
      (u.username.toLowerCase() === term || u.email.toLowerCase() === term)
    );

    if (!user) {
      return { success: false, message: 'Benutzername oder E-Mail existiert nicht.' };
    }

    if (!user.isActive) {
      return { success: false, message: 'Dieses Benutzerkonto wurde deaktiviert. Bitte an den Vorstand wenden.' };
    }

    const check = await verifyPassword(pass, user.password || '');
    if (!check.ok) {
      return { success: false, message: 'Das eingegebene Passwort ist nicht korrekt.' };
    }

    // Konto stammt noch aus der Zeit der Klartext-Passwörter: jetzt umstellen.
    if (check.needsUpgrade) {
      try {
        user.password = await hashPassword(pass);
      } catch (err) {
        console.warn('[AuthService] Passwort konnte nicht umgestellt werden:', err);
      }
    }

    // Login successful
    user.lastLogin = new Date().toISOString();
    this.saveUser(user);

    this.currentSession = {
      user,
      isAuthenticated: true,
      loginMethod: 'user',
      loginTime: new Date().toISOString()
    };

    this.persistSession(this.currentSession);
    this.startInactivityTracker();
    this.notifyListeners();

    return { success: true, user };
  }

  // One-Click Demo Login (Admin demo access)
  public static async loginDemo(): Promise<{ success: boolean; user?: AppUser }> {
    const users = this.getUsers();
    let admin = users.find(
      u => u.username === 'admin' || (u.permissions && canEdit(u.permissions, 'users'))
    );
    if (!admin) {
      admin = INITIAL_USERS[0];
      this.saveUser(admin);
    }

    admin.lastLogin = new Date().toISOString();
    this.saveUser(admin);

    this.currentSession = {
      user: admin,
      isAuthenticated: true,
      loginMethod: 'demo',
      loginTime: new Date().toISOString()
    };

    this.persistSession(this.currentSession);
    this.startInactivityTracker();
    this.notifyListeners();

    return { success: true, user: admin };
  }

  // Cloud Supabase Login (optional if configured)
  public static async loginWithSupabase(email: string, password: string): Promise<{ success: boolean; message?: string }> {
    try {
      const sb = getSupabaseClient();
      if (!sb) {
        return { success: false, message: 'Supabase Cloud ist nicht eingerichtet.' };
      }

      const { data, error } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error || !data.user) {
        return { success: false, message: error?.message || 'Anmeldung fehlgeschlagen.' };
      }

      // Die Rechte kommen aus der Tabelle club_users in der Cloud-Datenbank
      // — derselben, nach der sich auch die Zugriffsregeln des Servers
      // richten. Früher bekam hier jede angemeldete Kennung Vollzugriff.
      let clubUser = await fetchClubUser(data.user.id);

      // Nachzügler-Fall: Die Registrierung verlangte eine E-Mail-Bestätigung,
      // deshalb konnte der Eintrag damals nicht angelegt werden. Jetzt, bei
      // der ersten Anmeldung, wird er nachgeholt.
      if (!clubUser) {
        const pending = this.readSetupCode();
        if (pending) {
          const claim =
            pending.kind === 'invite'
              ? await acceptInvitation(pending.code)
              : await claimFirstAdmin(pending.code, pending.name, pending.roleLabel);
          if (claim.success) {
            this.forgetSetupCode();
            clubUser = await fetchClubUser(data.user.id);
          }
        }
      }

      if (!clubUser || !clubUser.isActive) {
        await sb.auth.signOut();
        return {
          success: false,
          message:
            'Anmeldung erfolgreich, aber dieses Konto ist für den Verein noch nicht ' +
            'freigeschaltet. Der Vorstand muss es in der Benutzerverwaltung eintragen.'
        };
      }

      const matchedUser: AppUser = {
        id: data.user.id,
        username: email.split('@')[0],
        email: data.user.email || email,
        name: clubUser.name || data.user.user_metadata?.full_name || email.split('@')[0],
        password: '',
        customRoleName: clubUser.roleName,
        permissions: clubUser.permissions,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      this.currentSession = {
        user: matchedUser,
        isAuthenticated: true,
        loginMethod: 'supabase',
        loginTime: new Date().toISOString()
      };

      this.persistSession(this.currentSession);
      this.startInactivityTracker();
      this.notifyListeners();
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'Verbindungsfehler.' };
    }
  }

  // Logout / Lock Session
  public static logout() {
    this.currentSession = {
      user: null,
      isAuthenticated: false
    };
    this.persistSession(this.currentSession);
    if (this.inactivityTimer) clearInterval(this.inactivityTimer);
    this.notifyListeners();
  }

  public static lockSession() {
    this.logout();
  }

  private static persistSession(session: UserAuthSession) {
    try {
      // Der Prüfwert des Passworts gehört in die Benutzerliste, nicht in die
      // gespeicherte Sitzung. Er würde dort nur ein zweites Mal herumliegen.
      const schlank: UserAuthSession = session.user
        ? { ...session, user: { ...session.user, password: '' } }
        : session;
      localStorage.setItem(STORAGE_KEY_CURRENT_SESSION, JSON.stringify(schlank));
    } catch (err) {
      console.warn('[AuthService] Could not persist session:', err);
    }
    this.recordActivity();
  }

  // ==========================================
  // USER MANAGEMENT CRUD (Controlled by Admin in Settings)
  // ==========================================
  public static getUsers(): AppUser[] {
    if (this.cachedUsers) return this.cachedUsers;
    const stored = localStorage.getItem(STORAGE_KEY_USERS);
    if (stored) {
      try {
        const parsed: AppUser[] = JSON.parse(stored);
        this.cachedUsers = parsed.map(withDefaultPermissions);
        return this.cachedUsers!;
      } catch {
        // fallback
      }
    }
    this.cachedUsers = [...INITIAL_USERS];
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(this.cachedUsers));
    } catch (err) {
      console.warn('Benutzerliste konnte nicht in localStorage gesichert werden (vermutlich Speicherplatz erschöpft):', err);
    }
    return this.cachedUsers;
  }

  public static saveUsers(users: AppUser[]): void {
    this.cachedUsers = users;
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch (err) {
      console.warn('[AuthService] Could not save users to localStorage (quota exceeded):', err);
    }
  }

  /**
   * Klartext-Passwörter aus dem Altbestand durch Prüfwerte ersetzen.
   *
   * Läuft einmal beim Start. Die Passwörter selbst ändern sich nicht — nur
   * das, was davon gespeichert wird. Niemand muss etwas neu vergeben.
   */
  private static async upgradeStoredPasswords(): Promise<void> {
    const users = this.getUsers();
    const betroffen = users.filter(u => u.password && !isHashed(u.password));
    if (betroffen.length === 0) return;

    try {
      for (const user of betroffen) {
        user.password = await hashPassword(user.password as string);
      }
      this.saveUsers(users);
      console.info(
        `[AuthService] ${betroffen.length} Passwort(e) auf gesicherte Speicherung umgestellt.`
      );
    } catch (err) {
      // Schlägt das fehl, bleibt der alte Zustand bestehen. Besser als ein
      // Verein, der sich nach einem halb durchgeführten Umbau nicht mehr
      // anmelden kann.
      console.warn('[AuthService] Umstellung der Passwörter fehlgeschlagen:', err);
    }
  }

  /**
   * Benutzer speichern und dabei ein neues Passwort setzen.
   *
   * Der Weg für alle Masken: Ein leeres Passwort lässt das bisherige
   * unverändert. Ein neues wird geprüft und nur als Prüfwert abgelegt.
   */
  public static async saveUserWithPassword(
    user: AppUser,
    neuesPasswort: string
  ): Promise<{ success: boolean; message?: string }> {
    const plain = (neuesPasswort || '').trim();
    const bestehend = this.getUsers().find(u => u.id === user.id);

    if (!plain) {
      if (!bestehend?.password) {
        return { success: false, message: 'Bitte ein Passwort für dieses Konto vergeben.' };
      }
      this.saveUser({ ...user, password: bestehend.password });
      return { success: true };
    }

    const strength = checkPasswordStrength(plain);
    if (!strength.ok) {
      return { success: false, message: strength.message };
    }

    try {
      this.saveUser({ ...user, password: await hashPassword(plain) });
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Das Passwort konnte nicht gesichert gespeichert werden.'
      };
    }
  }

  /**
   * ACHTUNG: Diese Methode schreibt niemals ein Klartext-Passwort in den
   * Speicher. Kommt eines herein — etwa aus einer Maske, die noch nicht
   * umgestellt ist —, wird der bisherige Prüfwert beibehalten und eine
   * Warnung ausgegeben. Lieber ein unverändertes Passwort als ein lesbares.
   */
  public static saveUser(user: AppUser): void {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === user.id);

    if (user.password && !isHashed(user.password)) {
      console.warn(
        '[AuthService] Klartext-Passwort abgewiesen. Bitte saveUserWithPassword() verwenden.'
      );
      user = { ...user, password: index >= 0 ? users[index].password : '' };
    }

    let updatedUser: AppUser;
    if (index >= 0) {
      updatedUser = { ...user, updatedAt: new Date().toISOString() };
      users[index] = updatedUser;
    } else {
      updatedUser = { ...user, createdAt: new Date().toISOString() };
      users.push(updatedUser);
    }
    this.saveUsers(users);

    // If active session user matches the modified user, update session and notify listeners immediately
    if (this.currentSession?.user?.id === user.id) {
      this.currentSession = {
        ...this.currentSession,
        user: updatedUser
      };
      this.persistSession(this.currentSession);
      this.notifyListeners();
    }
  }

  public static deleteUser(userId: string): boolean {
    const users = this.getUsers();
    const filtered = users.filter(u => u.id !== userId);
    if (filtered.length === users.length) return false;
    this.saveUsers(filtered);

    // If current logged-in user was deleted, logout
    if (this.currentSession?.user?.id === userId) {
      this.logout();
    }
    return true;
  }

  // ==========================================
  // SECURITY SETTINGS
  // ==========================================
  public static getSecuritySettings(): SecuritySettings {
    if (this.cachedSecurity) return this.cachedSecurity;
    const stored = localStorage.getItem(STORAGE_KEY_SECURITY);
    if (stored) {
      try {
        this.cachedSecurity = JSON.parse(stored);
        return this.cachedSecurity!;
      } catch {
        // fallback
      }
    }
    this.cachedSecurity = { ...DEFAULT_SECURITY_SETTINGS };
    try {
      localStorage.setItem(STORAGE_KEY_SECURITY, JSON.stringify(this.cachedSecurity));
    } catch (err) {
      console.warn('Sicherheitseinstellungen konnten nicht gesichert werden:', err);
    }
    return this.cachedSecurity;
  }

  public static saveSecuritySettings(settings: SecuritySettings): void {
    this.cachedSecurity = settings;
    try {
      localStorage.setItem(STORAGE_KEY_SECURITY, JSON.stringify(settings));
    } catch (err) {
      console.warn('[AuthService] Could not save security settings to localStorage:', err);
    }
    this.startInactivityTracker();
  }

  // ==========================================
  // PERMISSION CHECKERS
  // ==========================================
  /** Darf der angemeldete Benutzer diesen Bereich öffnen? */
  public static canView(area: PermissionArea): boolean {
    const user = this.getCurrentUser();
    if (!user || !user.permissions) return false;
    return canView(user.permissions, area);
  }

  /** Darf der angemeldete Benutzer in diesem Bereich etwas ändern? */
  public static canEdit(area: PermissionArea): boolean {
    const user = this.getCurrentUser();
    if (!user || !user.permissions) return false;
    return canEdit(user.permissions, area);
  }
}
