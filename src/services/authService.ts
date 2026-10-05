import { AuthSession, DeviceAccount } from '../types';
import { checkPasswordStrength, hashPassword, verifyPassword } from './passwordService';

const STORAGE_KEY_ACCOUNT = 'vm_device_account_v1';
const STORAGE_KEY_CURRENT_SESSION = 'vm_auth_session_v1';
const STORAGE_KEY_AUTO_LOCK_MINUTES = 'vm_auto_lock_minutes_v1';

/** 0 = nie, sonst Minuten Inaktivität bis zur automatischen Sperre. */
const DEFAULT_AUTO_LOCK_MINUTES = 15;

/**
 * Anmeldung für den lokalen Betrieb.
 *
 * WAS DAS LEISTET UND WAS NICHT
 *
 * Es gibt genau ein Passwort pro Gerät, kein Benutzerkonto, keine
 * Bereichsrechte mehr. Es sperrt nur die Bedienoberfläche gegen einen
 * zufälligen Blick an einem unbeaufsichtigten, entsperrten Rechner — es ist
 * keine Verschlüsselung der Vereinsdaten. Wer an die Browser-Datenbank
 * dieses Geräts kommt (Entwicklerwerkzeuge, Dateisystem), kommt auch ohne
 * dieses Passwort an die Daten. Siehe passwordService.ts für denselben
 * Hinweis zum Passwort selbst.
 *
 * Das Passwort reist bewusst NICHT mit einer Datensicherung mit (siehe
 * storage.ts, EINGERICHTET_KEY) — es gehört zu diesem Gerät, nicht zum
 * Verein.
 */
export class AuthService {
  private static currentSession: AuthSession | null = null;
  private static listeners: Array<(session: AuthSession) => void> = [];
  private static inactivityTimer: any = null;

  // ==========================================
  // INIT / SESSION
  // ==========================================
  public static async init(): Promise<AuthSession> {
    this.raeumeAltbestandAuf();

    const storedSession =
      localStorage.getItem(STORAGE_KEY_CURRENT_SESSION) ||
      sessionStorage.getItem(STORAGE_KEY_CURRENT_SESSION);

    if (storedSession) {
      try {
        const parsed: AuthSession = JSON.parse(storedSession);

        // Automatische Sperre nach Inaktivität
        if (parsed.isAuthenticated) {
          const autoLockMinutes = this.getAutoLockMinutes();
          if (autoLockMinutes > 0) {
            const lastActivity = Number(localStorage.getItem('vm_last_activity') || Date.now());
            const maxInactivityMs = autoLockMinutes * 60 * 1000;
            if (Date.now() - lastActivity > maxInactivityMs) {
              this.currentSession = { isAuthenticated: false };
              this.persistSession(this.currentSession);
              return this.currentSession;
            }
          }
        }

        this.currentSession = parsed;
        if (parsed.isAuthenticated) this.startInactivityTracker();
        return this.currentSession;
      } catch {
        // ignore
      }
    }

    this.currentSession = { isAuthenticated: false };
    this.persistSession(this.currentSession);
    return this.currentSession;
  }

  public static onAuthStateChanged(callback: (session: AuthSession) => void): () => void {
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
      const autoLockMinutes = this.getAutoLockMinutes();
      if (autoLockMinutes <= 0) return;
      if (!this.currentSession?.isAuthenticated) return;

      const lastActivity = Number(localStorage.getItem('vm_last_activity') || Date.now());
      const maxInactivityMs = autoLockMinutes * 60 * 1000;

      if (Date.now() - lastActivity > maxInactivityMs) {
        this.lockSession();
      }
    }, 30000);
  }

  public static getSession(): AuthSession {
    if (!this.currentSession) {
      const stored = localStorage.getItem(STORAGE_KEY_CURRENT_SESSION);
      if (stored) {
        try {
          this.currentSession = JSON.parse(stored);
        } catch {
          this.currentSession = { isAuthenticated: false };
        }
      } else {
        this.currentSession = { isAuthenticated: false };
      }
    }
    return this.currentSession;
  }

  public static isAuthenticated(): boolean {
    return Boolean(this.getSession().isAuthenticated);
  }

  /** Isolierter Demo-Modus mit fiktiven Beispieldaten, ohne jedes Passwort. */
  public static isDemoMode(): boolean {
    const session = this.getSession();
    return Boolean(session?.isAuthenticated && session?.loginMethod === 'demo');
  }

  private static persistSession(session: AuthSession) {
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_SESSION, JSON.stringify(session));
    } catch (err) {
      console.warn('[AuthService] Sitzung konnte nicht gespeichert werden:', err);
    }
    this.recordActivity();
  }

  /**
   * Räumt verwaiste Speicherreste der früheren Mehrbenutzer-/Rechteverwaltung
   * weg. Die darin enthaltenen Konten werden NICHT übernommen — eine
   * bestehende Installation hat ihre Vereinsdaten bereits (daran ändert sich
   * nichts), muss aber einmalig über "Registrieren" ein neues, einziges
   * Gerätepasswort vergeben.
   */
  private static raeumeAltbestandAuf(): void {
    try {
      localStorage.removeItem('vm_users_v2');
      localStorage.removeItem('vm_security_settings_v2');
      localStorage.removeItem('vm_auth_session_v2');
    } catch {
      // Kein Problem, wenn das nicht geht — es ist nur Aufräumen.
    }
  }

  // ==========================================
  // GERÄTEKONTO
  // ==========================================

  /** Existiert auf diesem Gerät bereits ein Passwort? */
  public static hatKonto(): boolean {
    return Boolean(this.getAccount());
  }

  private static getAccount(): DeviceAccount | null {
    const stored = localStorage.getItem(STORAGE_KEY_ACCOUNT);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as DeviceAccount;
    } catch {
      return null;
    }
  }

  private static saveAccount(account: DeviceAccount): void {
    try {
      localStorage.setItem(STORAGE_KEY_ACCOUNT, JSON.stringify(account));
    } catch (err) {
      console.warn('[AuthService] Gerätekonto konnte nicht gespeichert werden:', err);
    }
  }

  // ==========================================
  // REGISTRIEREN / ANMELDEN / ABMELDEN
  // ==========================================

  /**
   * Legt das (einzige) Passwort für dieses Gerät an.
   *
   * Lehnt ab, wenn schon eines existiert — ein zweiter Versuch auf einem
   * bereits eingerichteten Gerät würde sonst entweder ein zweites,
   * konkurrierendes Konto erzeugen oder das bestehende stillschweigend
   * überschreiben. Beides wäre falsch: Auf diesem Gerät liegen dann ja
   * schon Daten, die jemand mit dem bestehenden Passwort angelegt hat.
   */
  public static async registriere(
    benutzername: string,
    passwort: string
  ): Promise<{ success: boolean; message?: string }> {
    if (this.hatKonto()) {
      return {
        success: false,
        message:
          'Auf diesem Gerät ist bereits ein Konto eingerichtet. Bitte melden Sie sich stattdessen an.'
      };
    }

    const name = benutzername.trim();
    if (!name || name.length < 3) {
      return { success: false, message: 'Der Benutzername muss mindestens 3 Zeichen lang sein.' };
    }

    const staerke = checkPasswordStrength(passwort);
    if (!staerke.ok) {
      return { success: false, message: staerke.message };
    }

    const account: DeviceAccount = {
      benutzername: name,
      passwortPruefwert: await hashPassword(passwort.trim()),
      erstelltAm: new Date().toISOString()
    };
    this.saveAccount(account);

    this.currentSession = {
      isAuthenticated: true,
      benutzername: account.benutzername,
      loginMethod: 'user',
      loginTime: new Date().toISOString()
    };
    this.persistSession(this.currentSession);
    this.startInactivityTracker();
    this.notifyListeners();

    return { success: true };
  }

  public static async meldeAn(
    benutzername: string,
    passwort: string
  ): Promise<{ success: boolean; message?: string }> {
    const account = this.getAccount();
    if (!account) {
      return {
        success: false,
        message: 'Auf diesem Gerät ist noch kein Konto eingerichtet. Bitte zuerst registrieren.'
      };
    }

    const term = benutzername.trim().toLowerCase();
    let passwortStimmt: boolean;
    try {
      passwortStimmt = await verifyPassword(passwort.trim(), account.passwortPruefwert);
    } catch (err: any) {
      // Nur der Fall "Browser ohne Kryptographie" — das darf nicht als
      // falsches Passwort erscheinen.
      return { success: false, message: err?.message || 'Die Anmeldung konnte nicht geprüft werden.' };
    }

    // Benutzername und Passwort werden bewusst in einer gemeinsamen
    // Fehlermeldung beantwortet — sonst ließe sich erraten, welcher Teil
    // schon stimmt.
    if (term !== account.benutzername.toLowerCase() || !passwortStimmt) {
      return { success: false, message: 'Benutzername oder Passwort ist nicht korrekt.' };
    }

    this.currentSession = {
      isAuthenticated: true,
      benutzername: account.benutzername,
      loginMethod: 'user',
      loginTime: new Date().toISOString()
    };
    this.persistSession(this.currentSession);
    this.startInactivityTracker();
    this.notifyListeners();

    return { success: true };
  }

  /** Ändert das Passwort des bestehenden Gerätekontos. */
  public static async aendereBenutzerPasswort(
    neuesPasswort: string
  ): Promise<{ success: boolean; message?: string }> {
    const account = this.getAccount();
    if (!account) {
      return { success: false, message: 'Auf diesem Gerät ist kein Konto eingerichtet.' };
    }
    const staerke = checkPasswordStrength(neuesPasswort);
    if (!staerke.ok) {
      return { success: false, message: staerke.message };
    }
    account.passwortPruefwert = await hashPassword(neuesPasswort.trim());
    this.saveAccount(account);
    return { success: true };
  }

  // Isolierter Demo-Zugang — fiktive Beispieldaten, ohne Gerätekonto/Passwort.
  public static async loginDemo(): Promise<{ success: boolean }> {
    this.currentSession = {
      isAuthenticated: true,
      loginMethod: 'demo',
      loginTime: new Date().toISOString()
    };
    this.persistSession(this.currentSession);
    this.startInactivityTracker();
    this.notifyListeners();
    return { success: true };
  }

  public static logout() {
    this.currentSession = { isAuthenticated: false };
    this.persistSession(this.currentSession);
    if (this.inactivityTimer) clearInterval(this.inactivityTimer);
    this.notifyListeners();
  }

  public static lockSession() {
    this.logout();
  }

  // ==========================================
  // AUTOMATISCHE SPERRE NACH INAKTIVITÄT
  // ==========================================
  public static getAutoLockMinutes(): number {
    const stored = localStorage.getItem(STORAGE_KEY_AUTO_LOCK_MINUTES);
    const parsed = stored !== null ? Number(stored) : NaN;
    return Number.isFinite(parsed) ? parsed : DEFAULT_AUTO_LOCK_MINUTES;
  }

  public static setAutoLockMinutes(minutes: number): void {
    try {
      localStorage.setItem(STORAGE_KEY_AUTO_LOCK_MINUTES, String(minutes));
    } catch (err) {
      console.warn('[AuthService] Einstellung zur automatischen Sperre konnte nicht gespeichert werden:', err);
    }
    this.startInactivityTracker();
  }
}
