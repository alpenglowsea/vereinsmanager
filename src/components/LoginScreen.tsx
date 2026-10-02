import React, { useState, useRef, useEffect } from 'react';
import { AppUser, ClubSettings, DeploymentMode } from '../types';
import { AuthService } from '../services/authService';
import { StorageService } from '../services/storage';
import {
  isCloudSetupPending,
  sendPasswordReset,
  getSupabaseClient,
  getStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  sanitizeSupabaseUrl,
  testSupabaseConnection,
  SUPABASE_SCHEMA_SQL
} from '../services/supabaseClient';
import {
  statusAbfragen as leseEigenenServerStatus,
  passwortResetTokenAusAdresse,
  entferneResetTokenAusAdresse,
  passwortVergessenAnfordern,
  passwortMitTokenZuruecksetzen,
} from '../services/localServerAuth';
import { BackupImportDialog } from './BackupImportDialog';
import { BereichsVergleich, ImportArt, SicherungsKopf } from '../services/backupContents';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Building2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Cloud,
  Server,
  UserPlus,
  Mail,
  CheckCircle2,
  Upload,
  Database,
  KeyRound,
  Wifi,
  HardDrive,
  Copy
} from 'lucide-react';

interface LoginScreenProps {
  settings?: ClubSettings;
  deploymentMode: DeploymentMode;
  onLoginSuccess: (user: AppUser) => void;
  onSettingsReload?: (newSettings: ClubSettings) => void;
  /**
   * Wird aufgerufen, wenn hier auf dem Anmeldebildschirm die Betriebsart
   * gewechselt wird (siehe die Betriebsart-Auswahl im Registrieren-Tab
   * unten) — damit App.tsx seinen deploymentMode-State nachzieht, ohne dass
   * neu geladen werden muss.
   */
  onDeploymentModeChange?: (mode: DeploymentMode) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  settings,
  deploymentMode,
  onLoginSuccess,
  onSettingsReload,
  onDeploymentModeChange
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'import'>('login');

  // Cloud-Zugangsdaten-Formular (siehe Betriebsart-Auswahl im
  // Registrieren-Tab weiter unten) — direkt auf dem Anmeldebildschirm
  // erreichbar, damit sie nicht erst in den (nur angemeldet erreichbaren)
  // Einstellungen eingetragen werden müssen. Vorbelegt mit bereits
  // gespeicherten Werten, falls vorhanden (z. B. weil dieser Rechner schon
  // einmal mit dieser Cloud-Datenbank verbunden war).
  const [modeConfig, setModeConfig] = useState(() => getStoredSupabaseConfig());
  const [modeStatus, setModeStatus] = useState<{ loading: boolean; success?: boolean; message?: string }>({
    loading: false
  });
  const [effectiveMode, setEffectiveMode] = useState<DeploymentMode>(deploymentMode);

  useEffect(() => {
    setEffectiveMode(deploymentMode);
  }, [deploymentMode]);

  /**
   * Welche Betriebsart im Registrieren-Tab gerade ausgewählt ist. Getrennt
   * von effectiveMode, weil die Auswahl bei "Cloud" schon angezeigt werden
   * muss, bevor die Verbindung geprüft und effectiveMode tatsächlich
   * umgestellt wird (siehe handlePickCloud/handleSaveCloudConfig unten).
   * Folgt effectiveMode, sobald sich das von aussen ändert (z. B. direkt
   * nach dem Verbinden, oder weil schon vorher eine Betriebsart aktiv war).
   */
  const [regMode, setRegMode] = useState<DeploymentMode>(effectiveMode);
  useEffect(() => {
    setRegMode(effectiveMode);
  }, [effectiveMode]);
  // Ob das Cloud-Zugangsdaten-Formular im Registrieren-Tab aufgeklappt ist.
  // Offen, solange noch keine funktionierende Verbindung besteht; einmal
  // verbunden eingeklappt (nur noch ein "Zugangsdaten ändern"-Link), damit
  // das Formular nicht unnötig im Weg steht.
  const [cloudCredsOpen, setCloudCredsOpen] = useState(false);
  // Rückmeldung für den "SQL kopieren"-Knopf in der Cloud-Anleitung unten.
  const [copiedSql, setCopiedSql] = useState(false);
  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // Login State
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  /**
   * "Passwort vergessen" — gehosteter UND Cloud-Betrieb (nicht Lokalbetrieb,
   * siehe unten). Ein mitgeschicktes Token in der Adresszeile (gehosteter
   * Betrieb) hat Vorrang vor allem anderen — einmal beim ersten Rendern
   * gelesen, nicht bei jedem erneuten Rendern (sonst ginge der Wert
   * verloren, sobald LoginScreen aus einem anderen Grund neu rendert, z. B.
   * weil errorMsg sich ändert).
   */
  // deploymentMode ist ein Prop und von Anfang an da — anders als
  // isSelfhostedMode weiter unten, das erst nach der Registrierungs-Logik
  // deklariert wird, braucht es hier keine eigene Zwischenvariable.
  const [resetToken, setResetToken] = useState<string | null>(() =>
    deploymentMode === 'selfhosted' ? passwortResetTokenAusAdresse() : null
  );
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetNewPasswordConfirm, setResetNewPasswordConfirm] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  /**
   * Cloud-Betrieb: Supabase erkennt einen Reset-Link von sich aus (der
   * Client ist mit `detectSessionInUrl: true` angelegt, siehe
   * supabaseClient.ts) und meldet das über ein eigenes Ereignis
   * ("PASSWORD_RECOVERY"), statt wie beim gehosteten Betrieb über ein
   * eigenes Token in der Adresszeile. Deshalb ein eigener Merker statt der
   * Wiederverwendung von resetToken oben — beide Wege bestehen unabhängig
   * nebeneinander (siehe der Effekt weiter unten).
   */
  const [cloudRecoveryActive, setCloudRecoveryActive] = useState(false);

  // Register State
  const [regClubName, setRegClubName] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  // Nur im Cloud-Betrieb und nur, wenn bereits ein Vorstand eingetragen ist:
  // der Einladungscode (siehe cloudSetupPending unten). Für den allerersten
  // Vorstand wird kein Code mehr gebraucht.
  const [regSetupCode, setRegSetupCode] = useState('');
  const isCloudRegistration = effectiveMode === 'cloud';
  /**
   * Der Import auf dem Anmeldebildschirm ist für den Lokalbetrieb gedacht:
   * Bestand auf einen Stick, am anderen Rechner wieder einlesen. Im
   * Cloud-Betrieb liegen die Daten in der Vereinsdatenbank; ein Import würde
   * dort nur die Browser-Datenbank füllen und beim nächsten Laden wieder
   * überschrieben.
   */
  const importMoeglich = effectiveMode !== 'cloud';
  /**
   * Im gehosteten Betrieb gibt es genau einen Verein pro Server — das erste
   * Konto entsteht über die eigene Ersteinrichtung weiter oben (vor diesem
   * Rückgabewert), jedes weitere Konto legt ein Vorstand in der
   * Benutzerverwaltung an. Eine Selbst-Registrierung wie im Lokal- oder
   * Cloud-Betrieb ("neues Vereinskonto anlegen") passt hier nicht: Es gäbe ja
   * schon einen Verein auf diesem Server, in den man sich damit nicht
   * hineinregistrieren könnte.
   */
  const registrierenMoeglich = effectiveMode !== 'selfhosted';
  // Noch kein Benutzer in der Cloud-Datenbank? Dann richtet dieser Mensch den
  // Verein ein — ganz ohne Code. Sonst ist er eingeladen worden und hat
  // einen Einladungscode vom Vorstand.
  const [cloudSetupPending, setCloudSetupPending] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isCloudRegistration) return;
    let abgebrochen = false;
    isCloudSetupPending().then(pending => {
      if (!abgebrochen) setCloudSetupPending(pending);
    });
    return () => {
      abgebrochen = true;
    };
  }, [isCloudRegistration]);

  /**
   * Gehosteter Betrieb (eigener Server mit SQLite): Selbstregistrierung gibt
   * es hier nicht — neue Konten legt der Vorstand über die Benutzerverwaltung
   * an (siehe LocalServerUserAdminPanel). Die einzige Ausnahme ist das
   * allererste Konto, wenn der Server noch gar keines hat; das entscheidet
   * sich am Server, nicht im Browser, deshalb dieselbe Abfrage wie beim
   * Cloud-Betrieb oben (dort isCloudSetupPending, hier der eigene Server).
   */
  const isSelfhostedMode = effectiveMode === 'selfhosted';
  const [selfhostedSetupPending, setSelfhostedSetupPending] = useState<boolean | null>(null);
  const [selfhostedStatusError, setSelfhostedStatusError] = useState<string | null>(null);

  /**
   * Cloud- und gehosteter Betrieb melden ausschließlich über die
   * E-Mail-Adresse an — AuthService.login() weist einen reinen
   * Benutzernamen dort mit einer eigenen Fehlermeldung ab (siehe dort). Nur
   * der Lokalbetrieb kennt weiterhin echte Benutzernamen ohne E-Mail. Das
   * Eingabefeld unten zeigt entsprechend eine passende Bezeichnung, statt in
   * jedem Betrieb gleichermaßen "Benutzername oder E-Mail" zu versprechen.
   */
  const anmeldungNurPerEmail = deploymentMode === 'cloud' || isSelfhostedMode;

  useEffect(() => {
    if (!isSelfhostedMode) return;
    let abgebrochen = false;
    leseEigenenServerStatus().then(ergebnis => {
      if (abgebrochen) return;
      if ('fehler' in ergebnis) {
        setSelfhostedStatusError(ergebnis.fehler);
      } else {
        setSelfhostedSetupPending(ergebnis.setupPending);
      }
    });
    return () => {
      abgebrochen = true;
    };
  }, [isSelfhostedMode]);

  /**
   * Cloud-Betrieb: Ein Reset-Link von Supabase führt zurück auf genau diese
   * Adresse (siehe redirectTo bei handleForgotPasswordRequest unten) und
   * hängt seine eigenen Angaben hinter das Doppelkreuz. Der Supabase-Client
   * liest das beim Erzeugen selbst aus (detectSessionInUrl, siehe
   * supabaseClient.ts) und meldet es über genau dieses Ereignis — nicht über
   * ein eigenes Token wie beim gehosteten Betrieb. getSupabaseClient() hier
   * aufzurufen erzeugt den Client bei Bedarf erst (er entsteht sonst nirgends
   * von selbst, solange niemand angemeldet ist).
   */
  useEffect(() => {
    if (deploymentMode !== 'cloud') return;
    const client = getSupabaseClient();
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setCloudRecoveryActive(true);
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [deploymentMode]);

  // Ersteinrichtungsformular (gehosteter Betrieb, erstes Konto)
  const [setupName, setSetupName] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('');
  const [showSetupPassword, setShowSetupPassword] = useState(false);

  const handleSelfhostedSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!setupName.trim()) {
      setErrorMsg('Bitte Ihren Namen (Vorstand/Ansprechpartner) eingeben.');
      return;
    }
    if (!setupEmail.trim() || !setupEmail.includes('@')) {
      setErrorMsg('Bitte eine gültige E-Mail-Adresse angeben.');
      return;
    }
    if (setupPassword !== setupPasswordConfirm) {
      setErrorMsg('Die eingegebenen Passwörter stimmen nicht überein.');
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.setupSelfhosted(setupEmail, setupName, setupPassword);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMsg(res.message || 'Die Ersteinrichtung ist fehlgeschlagen.');
      }
    } catch {
      setErrorMsg('Unerwarteter Fehler bei der Ersteinrichtung.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setErrorMsg('Bitte eine gültige E-Mail-Adresse angeben.');
      return;
    }

    setLoading(true);
    try {
      // Cloud-Betrieb: Supabase verschickt die Mail selbst und muss wissen,
      // wohin der Link führen soll — auf genau diese laufende Installation
      // (siehe die ausführliche Begründung bei sendPasswordReset in
      // supabaseClient.ts). Gehosteter Betrieb: eigener Server, eigene
      // Mail, kein redirectTo nötig.
      //
      // Bewusst sofort in gleich geformte, eigene Variablen gelegt statt das
      // Ergebnis der beiden Aufrufe direkt weiterzureichen: Sie kommen aus
      // zwei verschiedenen Diensten mit unterschiedlich benannten Feldern
      // (error vs. message) — das hätte hier zu genau der Art von
      // TypeScript-Eigenart geführt, die in localServerAuth.ts vom
      // 27./28.09. schon einmal Ärger gemacht hat.
      let erfolg: boolean;
      let meldung: string | undefined;
      if (deploymentMode === 'cloud') {
        const res = await sendPasswordReset(forgotEmail.trim(), window.location.origin);
        erfolg = res.success;
        meldung = res.error;
      } else {
        const res = await passwortVergessenAnfordern(forgotEmail.trim());
        erfolg = res.success;
        meldung = res.message;
      }

      if (erfolg) {
        setSuccessMsg(
          deploymentMode === 'cloud'
            ? 'Falls zu dieser Adresse ein Konto besteht, wurde soeben eine E-Mail mit einem Link zum Zurücksetzen verschickt. Bitte diese E-Mail auf demselben Rechner öffnen, auf dem VereinsManager läuft — der Link führt sonst ins Leere.'
            : meldung ||
              'Falls zu dieser Adresse ein Konto besteht, wurde soeben eine E-Mail mit einem Link zum Zurücksetzen verschickt.'
        );
      } else {
        setErrorMsg(meldung || 'Die Anfrage ist fehlgeschlagen.');
      }
    } catch {
      setErrorMsg('Unerwarteter Fehler bei der Anfrage.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!resetToken) return;
    // Erst in eine eigene Konstante legen statt resetToken direkt weiter
    // unten zu verwenden: Dieselbe Vorsicht wie bei der Umstellung in
    // localServerAuth.ts vom 27./28.09. — dort hatte sich TypeScript beim
    // Verengen eines Wertes über eine Bedingung hinweg (ohne
    // strictNullChecks, siehe tsconfig.json) anders verhalten als erwartet.
    const token = resetToken;
    if (resetNewPassword !== resetNewPasswordConfirm) {
      setErrorMsg('Die eingegebenen Passwörter stimmen nicht überein.');
      return;
    }

    setLoading(true);
    try {
      const res = await passwortMitTokenZuruecksetzen(token, resetNewPassword);
      if (res.success) {
        entferneResetTokenAusAdresse();
        setResetDone(true);
        setSuccessMsg(res.message || 'Das Passwort wurde geändert. Sie können sich jetzt damit anmelden.');
      } else {
        setErrorMsg(res.message || 'Das Passwort konnte nicht geändert werden.');
      }
    } catch {
      setErrorMsg('Unerwarteter Fehler beim Zurücksetzen.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cloud-Betrieb: Der Reset-Link hat den Supabase-Client bereits in eine
   * "Wiederherstellungs-Sitzung" versetzt (siehe der PASSWORD_RECOVERY-Effekt
   * weiter oben) — die neue Anmeldung dort genügt Supabase bereits als
   * Nachweis, dass die Person die E-Mail wirklich geöffnet hat. Es braucht
   * deshalb kein eigenes Token wie beim gehosteten Betrieb: updateUser()
   * setzt das Passwort direkt für das gerade erkannte Konto.
   */
  const handleCloudResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (resetNewPassword !== resetNewPasswordConfirm) {
      setErrorMsg('Die eingegebenen Passwörter stimmen nicht überein.');
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setErrorMsg('Supabase ist nicht erreichbar.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await client.auth.updateUser({ password: resetNewPassword });
      if (!error) {
        // Die Wiederherstellungs-Sitzung, die Supabase für diesen Vorgang
        // angelegt hat, wieder abmelden: AuthService kennt sie ohnehin nicht
        // (es merkt sich Anmeldungen nur über die eigene, ausdrückliche
        // login()-Methode) — sie soll aber auch bei Supabase selbst nicht
        // stehen bleiben. Die Person meldet sich gleich ganz normal über das
        // Anmeldeformular an, mit dem gerade gesetzten Passwort.
        await client.auth.signOut();
        setResetDone(true);
        setSuccessMsg('Das Passwort wurde geändert. Sie können sich jetzt damit anmelden.');
      } else {
        setErrorMsg(error.message || 'Das Passwort konnte nicht geändert werden.');
      }
    } catch {
      setErrorMsg('Unerwarteter Fehler beim Zurücksetzen.');
    } finally {
      setLoading(false);
    }
  };

  // Import State
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /**
   * Die gelesene, aber noch nicht eingespielte Datei samt Abgleich. Solange
   * hier etwas steht, ist der Bestätigungsdialog offen und am Datenbestand
   * wurde noch nichts verändert.
   */
  const [importVorschau, setImportVorschau] = useState<{
    dateiName: string;
    text: string;
    kopf: SicherungsKopf;
    vergleich: BereichsVergleich[];
  } | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clubName = settings?.clubName || 'VereinsManager';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!usernameInput.trim()) {
      setErrorMsg(
        anmeldungNurPerEmail
          ? 'Bitte geben Sie Ihre E-Mail-Adresse ein.'
          : 'Bitte geben Sie Ihren Benutzernamen oder Ihre E-Mail ein.'
      );
      return;
    }
    if (!passwordInput) {
      setErrorMsg('Bitte geben Sie Ihr Passwort ein.');
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.login(usernameInput, passwordInput);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMsg(res.message || 'Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.');
      }
    } catch {
      setErrorMsg('Unerwarteter Fehler bei der Anmeldung.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await AuthService.loginDemo();
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMsg('Demo-Zugang konnte nicht geladen werden.');
      }
    } catch {
      setErrorMsg('Fehler beim Demo-Login.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================================
  // BETRIEBSART WÄHLEN — direkt im Registrieren-Tab (siehe dort weiter unten)
  // ==========================================================================
  //
  // Stand bis 01.10.: Die Betriebsart-Wahl lag in einem eigenen Tab, nur über
  // einen Fussknoten erreichbar. Ein neuer Anwender, der sich für Cloud
  // entscheidet, landete dadurch auf dem Registrieren-Formular, ohne zu
  // wissen, dass die Supabase-Zugangsdaten woanders eingetragen werden
  // müssen — die beiden Schritte liefen logisch auseinander. Jetzt ist die
  // Wahl Teil des Registrieren-Tabs selbst: erst Betriebsart aussuchen, bei
  // Cloud gleich die Anleitung samt Zugangsdaten-Formular darunter, erst
  // danach das eigentliche Kontoformular.
  //
  // Lokal und "Eigener Server" brauchen keine weitere Eingabe und werden
  // sofort aktiviert. Nur Cloud verlangt die Supabase-Zugangsdaten — siehe
  // handleSaveCloudConfig weiter unten, das erst nach erfolgreich geprüfter
  // Verbindung tatsächlich auf "cloud" umstellt.

  const uebernehmeBetriebsart = (mode: DeploymentMode) => {
    StorageService.setDeploymentMode(mode);
    setEffectiveMode(mode);
    onDeploymentModeChange?.(mode);
  };

  const handlePickLocal = () => {
    setRegMode('local');
    setCloudCredsOpen(false);
    uebernehmeBetriebsart('local');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handlePickCloud = () => {
    setRegMode('cloud');
    setErrorMsg(null);
    setSuccessMsg(null);
    // Nur aufklappen, wenn noch keine funktionierende Verbindung besteht —
    // war dieser Rechner schon vorher mit Cloud verbunden, reicht der
    // eingeklappte "Zugangsdaten ändern"-Link.
    if (effectiveMode !== 'cloud') {
      setCloudCredsOpen(true);
    }
  };

  const handlePickSelfhosted = () => {
    setRegMode('selfhosted');
    setErrorMsg(null);
    setSuccessMsg(null);
    uebernehmeBetriebsart('selfhosted');
    // Ab hier übernehmen die Prüfungen ganz oben in dieser Funktion
    // (isSelfhostedMode) die Anzeige von selbst — Ersteinrichtung oder
    // Anmeldung, je nachdem, ob der Server schon ein Konto hat.
  };

  const handleSaveCloudConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = sanitizeSupabaseUrl(modeConfig.url);
    if (cleanUrl !== modeConfig.url) {
      setModeConfig(prev => ({ ...prev, url: cleanUrl }));
    }
    if (!cleanUrl || !modeConfig.anonKey) {
      setModeStatus({ loading: false, success: false, message: 'Bitte Project URL und Anon Key eintragen.' });
      return;
    }

    setModeStatus({ loading: true });
    saveStoredSupabaseConfig(cleanUrl, modeConfig.anonKey);
    const res = await testSupabaseConnection(cleanUrl, modeConfig.anonKey);

    if (!res.success) {
      setModeStatus({
        loading: false,
        success: false,
        message: `Verbindung fehlgeschlagen: ${res.error || 'unbekannter Fehler'}. Bitte URL und Key prüfen.`
      });
      return;
    }

    uebernehmeBetriebsart('cloud');
    setModeStatus({ loading: false, success: true, message: 'Verbunden! Bitte unten das Konto anlegen.' });
    setCloudCredsOpen(false);
    // Direkt selbst abfragen statt auf den useEffect zu verlassen: War schon
    // vorher Cloud-Betrieb aktiv (z. B. nur die Zugangsdaten geändert), würde
    // sich isCloudRegistration nicht ändern und der Effekt nicht erneut laufen.
    isCloudSetupPending().then(pending => setCloudSetupPending(pending));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!regClubName.trim()) {
      setErrorMsg('Bitte geben Sie den Namen Ihres Vereins ein.');
      return;
    }
    if (!regFullName.trim()) {
      setErrorMsg('Bitte Ihren Namen (Vorstand/Ansprechpartner) eingeben.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMsg('Bitte eine gültige E-Mail-Adresse angeben.');
      return;
    }
    if (!regUsername.trim() || regUsername.trim().length < 3) {
      setErrorMsg('Der Benutzername muss mindestens 3 Zeichen lang sein.');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setErrorMsg('Das Passwort muss mindestens 4 Zeichen lang sein.');
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setErrorMsg('Die eingegebenen Passwörter stimmen nicht überein.');
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.register({
        clubName: regClubName,
        name: regFullName,
        email: regEmail,
        username: regUsername,
        password: regPassword,
        customRoleName: '1. Vorsitzender (Admin)',
        setupCode: regSetupCode
      });

      if (res.success && res.user) {
        // Initialize the live club settings with the entered club name
        await StorageService.initLiveClub(regClubName, regFullName, regEmail);
        setSuccessMsg(res.message || 'Konto erfolgreich angelegt! Anmeldung erfolgt...');
        setTimeout(() => {
          onLoginSuccess(res.user!);
        }, 600);
      } else if (res.requiresEmailConfirmation) {
        // Kein Fehler, sondern ein Zwischenschritt: Das Konto steht, es fehlt
        // nur die Bestätigung per E-Mail.
        setSuccessMsg(res.message || 'Bitte bestätigen Sie die E-Mail und melden Sie sich dann an.');
        setActiveTab('login');
        setUsernameInput(regEmail.trim().toLowerCase());
      } else {
        setErrorMsg(res.message || 'Registrierung fehlgeschlagen.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unerwarteter Fehler bei der Registrierung.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Erster Schritt: Datei lesen, prüfen und mit dem vorhandenen Bestand
   * abgleichen. Eingespielt wird hier noch nichts — das Ergebnis geht in den
   * Bestätigungsdialog.
   *
   * Bis Fassung 1.2 wurde an dieser Stelle sofort überschrieben. Eine falsch
   * erwischte Datei genügte, und der Bestand des Vereins war weg.
   */
  const processBackupFile = async (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setErrorMsg('Bitte wählen Sie eine gültige .json-Sicherungsdatei aus.');
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const { kopf, vergleich } = await StorageService.analysiereSicherung(text);
      setImportVorschau({ dateiName: file.name, text, kopf, vergleich });
    } catch (err: any) {
      console.error('Import-Vorschau fehlgeschlagen:', err);
      setErrorMsg(err?.message || 'Die Datei konnte nicht gelesen werden.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /** Zweiter Schritt: Der Anwender hat im Dialog bestätigt. */
  const fuehreImportAus = async (art: ImportArt) => {
    if (!importVorschau) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setImporting(true);

    try {
      const res = await StorageService.importFullBackup(importVorschau.text, 'live', art);
      setImportVorschau(null);

      const newSettings = await StorageService.getSettings();
      if (onSettingsReload && newSettings) {
        onSettingsReload(newSettings);
      }

      // Switch to login tab
      setActiveTab('login');

      const hinweisKopie = res.sicherheitskopie
        ? ''
        : ' Achtung: Die Sicherheitskopie des vorherigen Bestands konnte nicht angelegt werden.';
      const wasGeschah = art === 'ersetzen' ? 'eingespielt' : 'ergänzt';

      if (res.usersCount > 0) {
        const firstUser = res.restoredUsers?.[0]?.username || 'admin';
        setUsernameInput(firstUser);
        setPasswordInput('');
        setSuccessMsg(
          `Datensicherung von „${res.clubName || 'Verein'}“ erfolgreich ${wasGeschah}! (${res.membersCount} Mitglieder, ${res.transactionsCount} Buchungen, ${res.usersCount} Benutzerkonto/en). Sie können sich jetzt direkt mit Ihren Zugangsdaten anmelden.${hinweisKopie}`
        );
      } else {
        setUsernameInput('admin');
        setPasswordInput('');
        setSuccessMsg(
          `Datensicherung von „${res.clubName || 'Verein'}“ erfolgreich ${wasGeschah} (${res.membersCount} Mitglieder, ${res.transactionsCount} Buchungen). Hinweis: Da in dieser älteren Sicherung noch keine Benutzerkonten exportiert waren, können Sie sich mit dem Standard-Konto „admin“ (Passwort: „admin“) anmelden.${hinweisKopie}`
        );
      }
    } catch (err: any) {
      console.error('Import error on login screen:', err);
      setErrorMsg(`Fehler beim Einspielen der Datensicherung: ${err?.message || 'Ungültige Datei'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processBackupFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processBackupFile(file);
    }
  };

  // "Passwort vergessen": Ein mitgeschicktes Token hat Vorrang vor JEDER
  // anderen Ansicht dieses Bildschirms — auch vor der Serverprüfung unten,
  // die für diesen Sonderfall keine Rolle spielt.
  if (isSelfhostedMode && resetToken) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
            <div className="bg-slate-900 text-white p-6 sm:p-7 text-center relative overflow-hidden">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -left-8 -top-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-lg mb-3 ring-4 ring-white/10 p-1.5 overflow-hidden">
                <img
                  src={settings?.clubLogoUrl || '/logo_transparent.png'}
                  alt={clubName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    if (e.currentTarget.src !== window.location.origin + '/logo_transparent.png') {
                      e.currentTarget.src = '/logo_transparent.png';
                    }
                  }}
                />
              </div>
              <h1 className="text-xl font-extrabold text-white tracking-tight leading-tight">
                Neues Passwort setzen
              </h1>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                {resetDone ? 'Erledigt' : 'Für Ihr Konto auf diesem Server'}
              </p>
            </div>

            <div className="p-6 sm:p-7 space-y-5">
              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">{errorMsg}</div>
                </div>
              )}
              {successMsg && (
                <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">{successMsg}</div>
                </div>
              )}

              {resetDone ? (
                <button
                  type="button"
                  onClick={() => {
                    setResetToken(null);
                    setResetDone(false);
                    setSuccessMsg(null);
                  }}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Zur Anmeldung</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Neues Passwort *</label>
                    <div className="relative">
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        autoFocus
                        required
                        className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Wiederholen *</label>
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      value={resetNewPasswordConfirm}
                      onChange={(e) => setResetNewPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>Neues Passwort setzen</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Cloud-Betrieb, Gegenstück zum Block oben: Supabase hat den Reset-Link
  // bereits erkannt (siehe der PASSWORD_RECOVERY-Effekt weiter oben) — auch
  // das hat Vorrang vor jeder anderen Ansicht.
  if (deploymentMode === 'cloud' && cloudRecoveryActive) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
            <div className="bg-slate-900 text-white p-6 sm:p-7 text-center relative overflow-hidden">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -left-8 -top-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-lg mb-3 ring-4 ring-white/10 p-1.5 overflow-hidden">
                <img
                  src={settings?.clubLogoUrl || '/logo_transparent.png'}
                  alt={clubName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    if (e.currentTarget.src !== window.location.origin + '/logo_transparent.png') {
                      e.currentTarget.src = '/logo_transparent.png';
                    }
                  }}
                />
              </div>
              <h1 className="text-xl font-extrabold text-white tracking-tight leading-tight">
                Neues Passwort setzen
              </h1>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                {resetDone ? 'Erledigt' : 'Für Ihr Vereinskonto'}
              </p>
            </div>

            <div className="p-6 sm:p-7 space-y-5">
              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">{errorMsg}</div>
                </div>
              )}
              {successMsg && (
                <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">{successMsg}</div>
                </div>
              )}

              {resetDone ? (
                <button
                  type="button"
                  onClick={() => {
                    setCloudRecoveryActive(false);
                    setResetDone(false);
                    setSuccessMsg(null);
                  }}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Zur Anmeldung</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <form onSubmit={handleCloudResetPasswordSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Neues Passwort *</label>
                    <div className="relative">
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        autoFocus
                        required
                        className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Wiederholen *</label>
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      value={resetNewPasswordConfirm}
                      onChange={(e) => setResetNewPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>Neues Passwort setzen</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // "Passwort vergessen" — Anfrageformular (gehosteter UND Cloud-Betrieb,
  // siehe Link im Anmelde-Tab weiter unten).
  if ((isSelfhostedMode || deploymentMode === 'cloud') && showForgotPassword) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
            <div className="bg-slate-900 text-white p-6 sm:p-7 text-center relative overflow-hidden">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -left-8 -top-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-lg mb-3 ring-4 ring-white/10 p-1.5 overflow-hidden">
                <img
                  src={settings?.clubLogoUrl || '/logo_transparent.png'}
                  alt={clubName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    if (e.currentTarget.src !== window.location.origin + '/logo_transparent.png') {
                      e.currentTarget.src = '/logo_transparent.png';
                    }
                  }}
                />
              </div>
              <h1 className="text-xl font-extrabold text-white tracking-tight leading-tight">Passwort vergessen</h1>
              <p className="text-xs text-slate-400 mt-1 font-medium">Wir schicken Ihnen einen Link zum Zurücksetzen</p>
            </div>

            <div className="p-6 sm:p-7 space-y-5">
              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">{errorMsg}</div>
                </div>
              )}
              {successMsg && (
                <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">{successMsg}</div>
                </div>
              )}

              {!successMsg && (
                <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">E-Mail-Adresse</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="ihre-adresse@verein.de"
                        autoFocus
                        required
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Link zum Zurücksetzen schicken</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold hover:underline cursor-pointer"
                >
                  ← Zurück zur Anmeldung
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Gehosteter Betrieb, solange der Server noch nicht geantwortet hat: eine
  // kurze, ruhige Zwischenkarte statt eines Aufflackerns der Anmeldemaske,
  // die gleich darauf durch die Ersteinrichtung ersetzt werden könnte.
  if (isSelfhostedMode && selfhostedSetupPending === null && !selfhostedStatusError) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 flex items-center gap-3 text-sm text-slate-600">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin shrink-0" />
          <span>Serververbindung wird geprüft …</span>
        </div>
      </div>
    );
  }

  // Server nicht erreichbar (z. B. Zugriffsschlüssel fehlt noch, oder der
  // Container läuft nicht) — ohne diese Auskunft wüsste die Maske nicht,
  // ob sie Ersteinrichtung oder Anmeldung zeigen soll.
  if (isSelfhostedMode && selfhostedStatusError) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 p-7 space-y-4 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-base font-bold text-slate-900">Server nicht erreichbar</h1>
          <p className="text-xs text-slate-600 leading-relaxed">{selfhostedStatusError}</p>
          <button
            type="button"
            onClick={() => {
              setSelfhostedStatusError(null);
              setSelfhostedSetupPending(null);
              leseEigenenServerStatus().then(ergebnis => {
                if ('fehler' in ergebnis) setSelfhostedStatusError(ergebnis.fehler);
                else setSelfhostedSetupPending(ergebnis.setupPending);
              });
            }}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  // Ersteinrichtung: Auf diesem Server besteht noch gar kein Konto. Eine
  // eigene, schlanke Maske statt der Tabs unten — Registrieren/Importieren
  // ergeben vor dem ersten Konto keinen Sinn.
  if (isSelfhostedMode && selfhostedSetupPending) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
            <div className="bg-slate-900 text-white p-6 sm:p-7 text-center relative overflow-hidden">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -left-8 -top-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-lg mb-3 ring-4 ring-white/10 p-1.5 overflow-hidden">
                <img
                  src={settings?.clubLogoUrl || '/logo_transparent.png'}
                  alt={clubName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    if (e.currentTarget.src !== window.location.origin + '/logo_transparent.png') {
                      e.currentTarget.src = '/logo_transparent.png';
                    }
                  }}
                />
              </div>

              <h1 className="text-xl font-extrabold text-white tracking-tight leading-tight">
                Ersteinrichtung
              </h1>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Dieser Server hat noch kein Vorstandskonto — richten Sie es jetzt ein
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 border border-purple-400/30 rounded-full text-2xs font-bold text-purple-100">
                <Server className="w-3 h-3" />
                <span>Gehosteter Betrieb · Eigener Server</span>
              </div>
            </div>

            <div className="p-6 sm:p-7 space-y-5">
              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">{errorMsg}</div>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 bg-purple-50/80 border border-purple-200/80 rounded-xl text-2xs text-purple-900 leading-relaxed">
                <KeyRound className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  Dieses Konto bekommt automatisch Vollzugriff auf alle Bereiche. Weitere
                  Konten legen Sie danach unter „Einstellungen → Benutzer & Rechte" an.
                </div>
              </div>

              <form onSubmit={handleSelfhostedSetup} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Ihr Name (Vorstand) *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={setupName}
                      onChange={(e) => setSetupName(e.target.value)}
                      placeholder="z. B. Klaus Weber"
                      autoFocus
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    E-Mail-Adresse *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={setupEmail}
                      onChange={(e) => setSetupEmail(e.target.value)}
                      placeholder="vorstand@mein-verein.de"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Passwort *</label>
                    <div className="relative">
                      <input
                        type={showSetupPassword ? 'text' : 'password'}
                        value={setupPassword}
                        onChange={(e) => setSetupPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        required
                        className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSetupPassword(!showSetupPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showSetupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Wiederholen *</label>
                    <input
                      type={showSetupPassword ? 'text' : 'password'}
                      value={setupPasswordConfirm}
                      onChange={(e) => setSetupPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-bold rounded-xl shadow-md shadow-purple-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Vorstandskonto einrichten & anmelden</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
          {/* Header Banner */}
          <div className="bg-slate-900 text-white p-6 sm:p-7 text-center relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -left-8 -top-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-lg mb-3 ring-4 ring-white/10 p-1.5 overflow-hidden">
              <img
                src={settings?.clubLogoUrl || '/logo_transparent.png'}
                alt={clubName}
                className="w-full h-full object-contain"
                onError={(e) => {
                  if (e.currentTarget.src !== window.location.origin + '/logo_transparent.png') {
                    e.currentTarget.src = '/logo_transparent.png';
                  }
                }}
              />
            </div>

            <h1 className="text-xl font-extrabold text-white tracking-tight leading-tight">
              {activeTab === 'login'
                ? clubName
                : activeTab === 'register'
                ? 'Neues Vereinskonto anlegen'
                : 'Datensicherung importieren'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {activeTab === 'login'
                ? 'VereinsManager – Sichere Vereinsverwaltung'
                : activeTab === 'register'
                ? 'Betriebsart wählen & kostenlos starten'
                : 'JSON-Backup laden, um Verein & Konten wiederherzustellen'}
            </p>

            {/* Tab Switcher */}
            <div
              className={`mt-5 grid ${
                (registrierenMoeglich ? 1 : 0) + (importMoeglich ? 1 : 0) === 2
                  ? 'grid-cols-3'
                  : 'grid-cols-2'
              } p-1 bg-slate-800/80 border border-slate-700/60 rounded-xl gap-1`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  activeTab === 'login'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Anmelden</span>
              </button>
              {/* Im gehosteten Betrieb bewusst ausgeblendet — siehe
                  registrierenMoeglich weiter oben. */}
              {registrierenMoeglich && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('register');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    activeTab === 'register'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                  <span>Registrieren</span>
                </button>
              )}
              {/* Im Cloud-Betrieb gibt es diesen Weg bewusst nicht: Dort
                  schreibt ein Import nur in die Datenbank des Browsers, und
                  beim nächsten Laden überschreibt Supabase das wieder. Der
                  Anwender sähe eine Erfolgsmeldung und hätte nichts gewonnen. */}
              {importMoeglich && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('import');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    activeTab === 'import'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Datensicherung (.json) einspielen"
                >
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span>Importieren</span>
                </button>
              )}
            </div>
          </div>

          {/* Form Area */}
          <div className="p-6 sm:p-7 space-y-5">
            {/* Feedback Messages */}
            {errorMsg && (
              <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{errorMsg}</div>
              </div>
            )}
            {successMsg && (
              <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{successMsg}</div>
              </div>
            )}

            {/* TAB 1: LOGIN FORM */}
            {activeTab === 'login' && (
              <>
                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Username Input */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      {anmeldungNurPerEmail ? 'E-Mail-Adresse' : 'Benutzername oder E-Mail'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type={anmeldungNurPerEmail ? 'email' : 'text'}
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder={anmeldungNurPerEmail ? 'vorstand@verein.de' : 'z. B. admin oder vorstand@verein.de'}
                        autoComplete="username"
                        autoFocus
                        required
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Passwort
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Gehosteter und Cloud-Betrieb: eigener bzw. per
                        Supabase verschickter Reset-Link (siehe die beiden
                        Blöcke weiter oben). Im Lokalbetrieb gibt es diesen
                        Weg nicht — dort hilft ein JSON-Import weiter. */}
                    {(isSelfhostedMode || deploymentMode === 'cloud') && (
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setShowForgotPassword(true);
                            setForgotEmail(usernameInput.includes('@') ? usernameInput : '');
                            setErrorMsg(null);
                            setSuccessMsg(null);
                          }}
                          className="text-2xs text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
                        >
                          Passwort vergessen?
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Anmelden</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-2xs font-bold uppercase tracking-wider text-slate-400 shrink-0">
                    Oder Demo testen
                  </span>
                </div>

                  {/* Demo Access Action Box */}
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 space-y-2 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-900">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Getrennter Demo-Modus</span>
                    </div>
                    <p className="text-2xs text-amber-800/90 leading-relaxed">
                      Testen Sie alle Funktionen mit fiktiven Beispieldaten. Echte Vereinsdaten bleiben strikt getrennt.
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleDemoLogin}
                        disabled={loading}
                        className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-white" />
                        <span>Demo-Modus starten</span>
                      </button>
                    </div>
                  </div>

                {/* Switch to Register — im gehosteten Betrieb ausgeblendet,
                    siehe registrierenMoeglich weiter oben. */}
                {registrierenMoeglich && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('register');
                        setErrorMsg(null);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
                    >
                      Noch kein Vereinskonto? Jetzt registrieren →
                    </button>
                  </div>
                )}
              </>
            )}

            {/* TAB 2: REGISTER FORM */}
            {activeTab === 'register' && (
              <>
                {/* 1. Betriebsart — direkt hier statt in einem eigenen Tab,
                    damit von Anfang an klar ist, wo die Cloud-Zugangsdaten
                    hingehören (siehe Begründung bei handlePickLocal/
                    -Cloud/-Selfhosted weiter oben in dieser Datei). */}
                <div className="space-y-2">
                  <div className="text-2xs font-bold text-slate-500 uppercase tracking-wide">
                    1. Betriebsart
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={handlePickLocal}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        regMode === 'local'
                          ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      <HardDrive className="w-4 h-4" />
                      <span className="text-2xs font-bold leading-tight">Lokal</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePickCloud}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        regMode === 'cloud'
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400'
                      }`}
                    >
                      <Cloud className="w-4 h-4" />
                      <span className="text-2xs font-bold leading-tight">Cloud</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePickSelfhosted}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        regMode === 'selfhosted'
                          ? 'border-purple-600 bg-purple-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-purple-400'
                      }`}
                    >
                      <Server className="w-4 h-4" />
                      <span className="text-2xs font-bold leading-tight">Eigener Server</span>
                    </button>
                  </div>
                  <p className="text-2xs text-slate-400 leading-snug">
                    {regMode === 'local' &&
                      'Daten liegen ausschliesslich im Browser dieses Rechners. Später jederzeit wechselbar.'}
                    {regMode === 'cloud' &&
                      'Mehrere Benutzer, von überall erreichbar — Daten liegen bei Supabase (EU-Server).'}
                    {regMode === 'selfhosted' &&
                      'Für den selbst gehosteten Betrieb (NAS, eigener Rechner, Docker).'}
                  </p>
                </div>

                {/* 2. Cloud: Anleitung + Zugangsdaten — nur solange noch
                    keine funktionierende Verbindung besteht, oder wenn der
                    Anwender sie nachträglich ändern will. */}
                {regMode === 'cloud' && (effectiveMode !== 'cloud' || cloudCredsOpen) && (
                  <div className="border border-blue-200 bg-blue-50/70 rounded-xl p-3.5 space-y-3">
                    <div className="text-2xs font-bold text-blue-900 uppercase tracking-wide">
                      2. Supabase-Projekt verbinden
                    </div>
                    <ol className="space-y-2 text-2xs text-blue-950 leading-relaxed list-decimal list-outside pl-4">
                      <li>
                        Kostenloses Konto auf{' '}
                        <a
                          href="https://supabase.com"
                          target="_blank"
                          rel="noreferrer"
                          className="underline font-semibold"
                        >
                          supabase.com
                        </a>{' '}
                        anlegen und ein neues Projekt erstellen (als Region möglichst „Europe" wählen).
                      </li>
                      <li>
                        Im Projekt links auf <strong>SQL Editor</strong>, dort eine neue Abfrage
                        anlegen, das Skript einfügen und mit <strong>Run</strong> ausführen:
                        <div className="mt-1.5">
                          <button
                            type="button"
                            onClick={handleCopySql}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white text-2xs font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedSql ? 'Kopiert!' : 'SQL-Skript kopieren'}</span>
                          </button>
                        </div>
                      </li>
                      <li>
                        Links auf <strong>Project Settings → API</strong> wechseln und dort die{' '}
                        <strong>Project URL</strong> sowie den <strong>anon / public Key</strong> kopieren —
                        unten eintragen.
                      </li>
                    </ol>

                    {modeStatus.message && (
                      <div
                        className={`flex items-start gap-2 p-2.5 rounded-lg text-2xs leading-relaxed ${
                          modeStatus.success
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border border-rose-200 text-rose-800'
                        }`}
                      >
                        {modeStatus.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        )}
                        <span>{modeStatus.message}</span>
                      </div>
                    )}

                    <form onSubmit={handleSaveCloudConfig} className="space-y-2">
                      <div className="space-y-1">
                        <label className="block text-2xs font-bold text-slate-700">Project URL</label>
                        <input
                          type="text"
                          value={modeConfig.url}
                          onChange={(e) => setModeConfig(prev => ({ ...prev, url: e.target.value }))}
                          placeholder="https://xxxxxxxx.supabase.co"
                          autoComplete="off"
                          spellCheck={false}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-2xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-2xs font-bold text-slate-700">Anon / Publishable Key</label>
                        <input
                          type="text"
                          value={modeConfig.anonKey}
                          onChange={(e) => setModeConfig(prev => ({ ...prev, anonKey: e.target.value }))}
                          placeholder="eyJhbGciOi..."
                          autoComplete="off"
                          spellCheck={false}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-2xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={modeStatus.loading}
                        className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
                      >
                        {modeStatus.loading ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Wifi className="w-3.5 h-3.5" />
                            <span>Verbinden &amp; aktivieren</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}
                {regMode === 'cloud' && effectiveMode === 'cloud' && !cloudCredsOpen && (
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-2xs">
                    <span className="flex items-center gap-1.5 text-emerald-900 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Mit Supabase-Projekt verbunden
                    </span>
                    <button
                      type="button"
                      onClick={() => setCloudCredsOpen(true)}
                      className="text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer shrink-0"
                    >
                      Zugangsdaten ändern
                    </button>
                  </div>
                )}

                {/* 3. Das Kontoformular selbst — bei Lokal sofort sichtbar,
                    bei Cloud erst nach erfolgreich geprüfter Verbindung oben.
                    "Eigener Server" braucht dieses Formular nicht:
                    handlePickSelfhosted schaltet die Ansicht sofort auf die
                    server-eigene Ersteinrichtung bzw. Anmeldung um (siehe
                    isSelfhostedMode ganz oben in dieser Datei). */}
                {(regMode === 'local' || (regMode === 'cloud' && effectiveMode === 'cloud')) && (
                <>
                <div className="text-2xs font-bold text-slate-500 uppercase tracking-wide pt-1">
                  {regMode === 'cloud' ? '3. Vereinskonto' : '2. Vereinskonto'}
                </div>
                <form onSubmit={handleRegister} className="space-y-3.5">
                  {/* Club Name */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Vereinsname *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={regClubName}
                        onChange={(e) => setRegClubName(e.target.value)}
                        placeholder="z. B. SV Eintracht 1924 e.V."
                        required
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                      />
                    </div>
                  </div>

                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Vor- & Nachname (Vorstand / Admin) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        placeholder="z. B. Klaus Weber"
                        required
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      E-Mail-Adresse *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="vorstand@mein-verein.de"
                        required
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                      />
                    </div>
                  </div>

                  {/* Username & Password Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Benutzername *
                      </label>
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="vorstand"
                        required
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Passwort *
                      </label>
                      <div className="relative">
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Passwort wiederholen *
                    </label>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPasswordConfirm}
                      onChange={(e) => setRegPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                    />
                  </div>

                  {/* Einladungscode — nur im Cloud-Betrieb, und nur, wenn
                      schon ein Vorstand eingetragen ist. Der allererste
                      Vorstand braucht keinen Code. */}
                  {isCloudRegistration && cloudSetupPending === false && (
                    <div className="space-y-1 pt-1">
                      <label className="block text-xs font-bold text-slate-700">Einladungscode *</label>
                      <input
                        type="text"
                        value={regSetupCode}
                        onChange={(e) => setRegSetupCode(e.target.value)}
                        placeholder="ABCD-1234-EF56"
                        required
                        autoComplete="off"
                        spellCheck={false}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono tracking-wider text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none uppercase"
                      />
                      <p className="text-2xs text-slate-500 leading-snug">
                        Für diesen Verein ist bereits ein Vorstand eingetragen. Sie brauchen
                        daher einen <strong>Einladungscode</strong>, den Ihnen der Vorstand
                        gibt. Melden Sie sich mit genau der E-Mail-Adresse an, an die die
                        Einladung ausgestellt wurde.
                      </p>
                    </div>
                  )}
                  {isCloudRegistration && cloudSetupPending === true && (
                    <div className="flex items-start gap-2 p-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-2xs text-emerald-900 leading-relaxed">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        Für diesen Verein ist noch kein Vorstand eingetragen — Sie werden es mit
                        diesem Konto, ganz ohne Code.
                      </span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Vereinskonto erstellen & starten</span>
                      </>
                    )}
                  </button>
                </form>
                </>
                )}

                {/* Back to login button */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      setErrorMsg(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold hover:underline cursor-pointer"
                  >
                    ← Bereits registriert? Zum Login
                  </button>
                </div>
              </>
            )}

            {/* TAB 3: IMPORT BACKUP */}
            {activeTab === 'import' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs text-blue-900 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-blue-950">
                    <Database className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Nahtloser Umzug auf diesen Rechner</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-normal">
                    Laden Sie hier Ihre am anderen PC exportierte <span className="font-semibold text-slate-800">.json-Datensicherung</span> hoch. Alle Daten sowie <strong>Benutzerkonten & Rollen</strong> werden direkt in die lokale Live-Datenbank übertragen, sodass Sie sich anschließend direkt wie gewohnt anmelden können.
                  </p>
                  <p className="text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1.5 text-[11px] leading-normal mt-1.5">
                    <strong>Nur für den reinen Lokalbetrieb</strong> („Nur dieses Gerät") — die Datei
                    landet ausschliesslich in der lokalen Browser-Datenbank. Für den Umzug in die
                    Cloud bitte stattdessen „Registrieren" mit Betriebsart Cloud und danach
                    Einstellungen → Betriebsmodi → „Lokale Daten in die Cloud übertragen" nutzen.
                  </p>
                </div>

                {/* Dropzone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !importing && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-blue-600 bg-blue-50/70 scale-[1.01]'
                      : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50/80 bg-white'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                    id="login-backup-file-input"
                  />

                  {importing ? (
                    <div className="py-4 flex flex-col items-center justify-center gap-2.5">
                      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <div className="text-xs font-bold text-slate-800">Datensicherung wird importiert...</div>
                      <div className="text-2xs text-slate-500">Datenbank & Benutzerkonten werden eingerichtet</div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="mt-1">
                        <span className="text-xs font-bold text-blue-600 hover:underline">
                          JSON-Sicherung auswählen
                        </span>
                        <span className="text-xs text-slate-500"> oder Datei hierher ziehen</span>
                      </div>
                      <p className="text-2xs text-slate-400 font-medium">
                        Unterstützt VereinsManager .json Sicherungsdateien
                      </p>
                    </div>
                  )}
                </div>

                {/* Back to login button */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      setErrorMsg(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold hover:underline cursor-pointer"
                  >
                    ← Zurück zur Anmeldung
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Footer Info — immer sichtbar, damit der Wechsel zu Cloud auch
              aus dem Lokalbetrieb heraus entdeckt wird. Die Betriebsart
              selbst wählt man seit 02.10. direkt im Registrieren-Tab (siehe
              dort), der Footer verlinkt nur noch dorthin. */}
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-2xs text-slate-500">
            <div className="flex items-center gap-1.5">
              {effectiveMode === 'local' && (
                <>
                  <HardDrive className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-semibold text-slate-700">Nur dieses Gerät</span>
                </>
              )}
              {effectiveMode === 'cloud' && (
                <>
                  <Cloud className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-semibold text-slate-700">Cloud (Supabase EU)</span>
                  <span
                    className="text-slate-400"
                    title="Im Cloud-Betrieb liegen die Daten in der Vereinsdatenbank. Eine Datensicherung wird dort nach der Anmeldung unter Einstellungen → Datensicherung eingespielt."
                  >
                    · Datensicherung nach der Anmeldung
                  </span>
                </>
              )}
              {effectiveMode === 'selfhosted' && (
                <>
                  <Server className="w-3.5 h-3.5 text-purple-600" />
                  <span className="font-semibold text-slate-700">Docker Selbsthosting</span>
                </>
              )}
            </div>

            {activeTab !== 'register' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setModeStatus({ loading: false });
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
              >
                Betriebsart ändern
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bestätigung vor dem Einspielen. Solange dieser Dialog offen ist,
          wurde am Datenbestand noch nichts verändert. */}
      <BackupImportDialog
        isOpen={Boolean(importVorschau)}
        dateiName={importVorschau?.dateiName || ''}
        kopf={importVorschau?.kopf || {}}
        vergleich={importVorschau?.vergleich || []}
        laeuft={importing}
        onAbbrechen={() => setImportVorschau(null)}
        onBestaetigen={fuehreImportAus}
      />
    </div>
  );
};
