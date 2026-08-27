import { AppUser, SecuritySettings, UserAuthSession, UserPermissions } from '../types';
import { FULL_PERMISSIONS, INITIAL_USERS, DEFAULT_SECURITY_SETTINGS } from '../data/roles';
import { getSupabaseClient } from './supabaseClient';

const STORAGE_KEY_USERS = 'vm_users_v2';
const STORAGE_KEY_SECURITY = 'vm_security_settings_v2';
const STORAGE_KEY_CURRENT_SESSION = 'vm_auth_session_v2';

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
    if (!password || password.length < 4) {
      return { success: false, message: 'Das Passwort muss mindestens 4 Zeichen lang sein.' };
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
      password,
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

  // Standard Login with Username / Email and Password
  public static async login(usernameOrEmail: string, password: string): Promise<{ success: boolean; message?: string; user?: AppUser }> {
    const term = usernameOrEmail.trim().toLowerCase();
    const pass = password.trim();

    if (!term || !pass) {
      return { success: false, message: 'Bitte Benutzername und Passwort eingeben.' };
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

    if (user.password !== pass) {
      return { success: false, message: 'Das eingegebene Passwort ist nicht korrekt.' };
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
    let admin = users.find(u => u.username === 'admin' || u.permissions.canManageUsers);
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

      const users = this.getUsers();
      let matchedUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!matchedUser) {
        matchedUser = {
          id: data.user.id,
          username: email.split('@')[0],
          email: data.user.email || email,
          name: data.user.user_metadata?.full_name || email.split('@')[0],
          password: '',
          customRoleName: 'Cloud-Benutzer',
          permissions: { ...FULL_PERMISSIONS },
          isActive: true,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        };
        this.saveUser(matchedUser);
      }

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
    localStorage.setItem(STORAGE_KEY_CURRENT_SESSION, JSON.stringify(session));
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
        this.cachedUsers = JSON.parse(stored);
        return this.cachedUsers!;
      } catch {
        // fallback
      }
    }
    this.cachedUsers = [...INITIAL_USERS];
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(this.cachedUsers));
    return this.cachedUsers;
  }

  public static saveUsers(users: AppUser[]): void {
    this.cachedUsers = users;
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  }

  public static saveUser(user: AppUser): void {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = { ...user, updatedAt: new Date().toISOString() };
    } else {
      users.push({ ...user, createdAt: new Date().toISOString() });
    }
    this.saveUsers(users);
  }

  public static deleteUser(userId: string): boolean {
    const users = this.getUsers();
    const filtered = users.filter(u => u.id !== userId);
    if (filtered.length === users.length) return false;
    this.saveUsers(filtered);
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
    localStorage.setItem(STORAGE_KEY_SECURITY, JSON.stringify(this.cachedSecurity));
    return this.cachedSecurity;
  }

  public static saveSecuritySettings(settings: SecuritySettings): void {
    this.cachedSecurity = settings;
    localStorage.setItem(STORAGE_KEY_SECURITY, JSON.stringify(settings));
    this.startInactivityTracker();
  }

  // ==========================================
  // PERMISSION CHECKERS
  // ==========================================
  public static can(permissionKey: keyof UserPermissions): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    return Boolean(user.permissions && user.permissions[permissionKey]);
  }
}
