import React, { useState, useEffect, useRef } from 'react';
import { ClubSettings, Address, BoardMember, ColorSchemeId, FontChoiceId } from '../types';
import { COLOR_SCHEMES, FONT_CHOICES, DEFAULT_COLOR_SCHEME, DEFAULT_FONT_CHOICE } from '../utils/appearance';
import { StorageService } from '../services/storage';
import { AuthService } from '../services/authService';
import { SnapshotService, AutoSnapshot } from '../services/snapshotService';
import { CURRENT_APP_VERSION } from '../services/updateService';
import { BackupImportDialog } from './BackupImportDialog';
import { BackupExportDialog } from './BackupExportDialog';
import { BackupPasswordDialog } from './BackupPasswordDialog';
import { istVerschluesselt, verschluessleSicherung, entschluessleSicherung } from '../services/backupCrypto';
import { BereichsVergleich, ImportArt, SicherungsKopf } from '../services/backupContents';
import { openExternalUrl } from '../utils/externalLink';
import { saveBlobWithLocationPicker } from '../utils/fileExportHelper';
import QRCode from 'qrcode';
import {
  Settings,
  Palette,
  Type,
  Building,
  Database,
  Users,
  Shield,
  ShieldCheck,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  CreditCard,
  Sun,
  Moon,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  User as UserIcon,
  Eye,
  EyeOff,
  Check,
  Sparkles,
  Server,
  CheckCheck,
  Mail,
  Heart,
  ExternalLink,
  Copy,
  Coffee,
  QrCode,
  ZoomIn,
  X,
  Maximize2,
  Bug,
  Send,
  MessageSquare,
  HelpCircle,
  Info,
  History,
  RotateCcw,
  Clock,
  Archive,
  GripVertical,
  Plus,
  Lock,
  FileText
} from 'lucide-react';

/**
 * Freiwillige Unterstützung des Projekts (Tab "Projekt unterstützen").
 * ---------------------------------------------------------------------------
 * Gilt für JEDEN Verein, der VereinsManager installiert — es unterstützt den
 * Ersteller der Software, nicht den jeweiligen Verein. Gehört deshalb bewusst
 * NICHT in ClubSettings (das sind die Vereinsstammdaten, die jeder Verein für
 * sich selbst pflegt), sondern ist ein reiner Code-Wert wie dieser hier.
 *
 * Früher stand dieser Link doppelt im Code (einmal in der Haupt-Kachel,
 * einmal im Vergrößerungs-Dialog) — dabei ist offenbar eine der beiden
 * Stellen versehentlich auf einen fremden PayPal-Account (paypal.me/strelitzerfc)
 * geändert worden. Jetzt gibt es nur noch diese eine Stelle.
 */
const PROJECT_SUPPORT_URL = 'https://liberapay.com/alpenglowsea/';

interface SettingsViewProps {
  settings: ClubSettings;
  onSaveSettings: (settings: ClubSettings) => void;
  onDataReload?: () => void;
  currentTheme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  initialTab?: SettingsTab;
  onTabChange?: (tab: SettingsTab) => void;
}

export const parseClubAddress = (addr: Address | string | undefined): Address => {
  if (!addr) return { street: '', houseNumber: '', zip: '', city: '', country: 'Deutschland' };
  if (typeof addr === 'object' && addr !== null) {
    return {
      street: addr.street || '',
      houseNumber: addr.houseNumber || '',
      zip: addr.zip || '',
      city: addr.city || '',
      country: addr.country || 'Deutschland'
    };
  }
  const str = String(addr).trim();
  const parts = str.split(',').map(s => s.trim());
  if (parts.length >= 2) {
    const streetPart = parts[0] || '';
    const cityPart = parts[1] || '';
    const streetMatch = streetPart.match(/^(.*?)\s*(\d+[\w\s/-]*)$/);
    const cityMatch = cityPart.match(/^(\d{4,5})\s+(.*)$/);
    return {
      street: streetMatch ? streetMatch[1] : streetPart,
      houseNumber: streetMatch ? streetMatch[2] : '',
      zip: cityMatch ? cityMatch[1] : '',
      city: cityMatch ? cityMatch[2] : cityPart,
      country: parts[2] || 'Deutschland'
    };
  }
  return { street: str, houseNumber: '', zip: '', city: '', country: 'Deutschland' };
};

export const formatClubAddress = (addr: Address | string | undefined): string => {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  const parts = [
    [addr.street, addr.houseNumber].filter(Boolean).join(' '),
    [addr.zip, addr.city].filter(Boolean).join(' '),
    addr.country && addr.country !== 'Deutschland' ? addr.country : ''
  ].filter(Boolean);
  return parts.join(', ');
};

export const formatIbanWithSpaces = (iban: string = ''): string => {
  return iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
};

export const getInitialBoardMembers = (s: ClubSettings): BoardMember[] => {
  if (s.boardMembers && s.boardMembers.length > 0) {
    return s.boardMembers;
  }
  const list: BoardMember[] = [];
  if (s.chairman) {
    list.push({ id: 'bm-1', role: '1. Vorsitzender', name: s.chairman, email: s.email || '' });
  } else {
    list.push({ id: 'bm-1', role: '1. Vorsitzender', name: '' });
  }
  if (s.treasurer) {
    list.push({ id: 'bm-2', role: 'Schatzmeister / Kassenwart', name: s.treasurer });
  } else {
    list.push({ id: 'bm-2', role: 'Schatzmeister / Kassenwart', name: '' });
  }
  return list;
};

type SettingsTab = 'general' | 'club' | 'backup' | 'support' | 'bugreport';

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onDataReload,
  currentTheme,
  onThemeChange,
  initialTab,
  onTabChange,
}) => {
  // Tab sequence:
  // 1. Allgemeine Einstellungen
  // 2. Vereinsstammdaten
  // 3. Datensicherung und Import
  // 4. Projekt unterstützen
  // 5. Problem melden
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'general');

  const prevInitialTabRef = useRef(initialTab);

  const switchTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    prevInitialTabRef.current = tab;
    onTabChange?.(tab);
  };

  useEffect(() => {
    if (initialTab && initialTab !== prevInitialTabRef.current) {
      setActiveTab(initialTab);
      prevInitialTabRef.current = initialTab;
    }
  }, [initialTab]);

  // Structured Address State for Club Settings
  const [clubAddress, setClubAddress] = useState<Address>(() =>
    parseClubAddress(settings.clubAddress || settings.address)
  );

  // Form State for Club & General Settings
  const [formData, setFormData] = useState<ClubSettings>({
    ...settings,
    currency: settings.currency || 'EUR',
    dateFormat: settings.dateFormat || 'DD.MM.YYYY',
    fiscalYearStart: settings.fiscalYearStart || '01-01',
    theme: currentTheme || settings.theme || 'light'
  });

  // Dynamic Board Members State
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>(() =>
    getInitialBoardMembers(settings)
  );

  // Board Member Drag and Drop State
  const [draggedBoardIndex, setDraggedBoardIndex] = useState<number | null>(null);
  const [dragOverBoardIndex, setDragOverBoardIndex] = useState<number | null>(null);

  // Department Drag and Drop State
  const [draggedDeptIndex, setDraggedDeptIndex] = useState<number | null>(null);
  const [dragOverDeptIndex, setDragOverDeptIndex] = useState<number | null>(null);

  // Club Save Feedback State
  const [isSavingClub, setIsSavingClub] = useState(false);
  const [clubSaveSuccess, setClubSaveSuccess] = useState(false);
  const [clubSaveFeedbackText, setClubSaveFeedbackText] = useState<string | null>(null);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      ...settings,
      currency: settings.currency || prev.currency || 'EUR',
      dateFormat: settings.dateFormat || prev.dateFormat || 'DD.MM.YYYY',
      fiscalYearStart: settings.fiscalYearStart || prev.fiscalYearStart || '01-01',
      theme: currentTheme || settings.theme || prev.theme || 'light'
    }));
    setClubAddress(parseClubAddress(settings.clubAddress || settings.address));
    setBoardMembers(getInitialBoardMembers(settings));
  }, [settings, currentTheme]);

  const [newDepartment, setNewDepartment] = useState('');
  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // QR-Code für die freiwillige Projektunterstützung (Tab 6): wird aus
  // PROJECT_SUPPORT_URL selbst erzeugt statt als Bilddatei mitgeliefert zu
  // werden — Link und QR-Code können dadurch nie mehr auseinanderlaufen, wie
  // es dem alten PayPal-Screenshot passiert ist.
  const [projectSupportQrUrl, setProjectSupportQrUrl] = useState<string | null>(null);
  useEffect(() => {
    let abgebrochen = false;
    QRCode.toDataURL(PROJECT_SUPPORT_URL, {
      width: 480,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' }
    })
      .then(url => {
        if (!abgebrochen) setProjectSupportQrUrl(url);
      })
      .catch(fehler => {
        console.error('QR-Code für die Projektunterstützung konnte nicht erzeugt werden:', fehler);
      });
    return () => {
      abgebrochen = true;
    };
  }, []);

  // Gerätepasswort ändern (Tab 3)
  const [newDevicePassword, setNewDevicePassword] = useState('');
  const [newDevicePasswordRepeat, setNewDevicePasswordRepeat] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userMsg, setUserMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Automatische Sperre: gilt für dieses Gerät (nicht für den Verein) und wird
  // deshalb sofort beim Auswählen gespeichert, nicht erst mit dem
  // „Speichern"-Knopf der Vereinsdaten.
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(() => AuthService.getAutoLockMinutes());
  const AUTO_LOCK_CHOICES = [5, 10, 15, 30, 60, 120, 240];
  const handleAutoLockChange = (minutes: number) => {
    setAutoLockMinutes(minutes);
    AuthService.setAutoLockMinutes(minutes);
  };

  /**
   * Gelesene, aber noch nicht eingespielte Datensicherung samt Abgleich.
   * Solange hier etwas steht, ist der Bestätigungsdialog offen und am
   * Datenbestand wurde noch nichts verändert.
   */
  // Datensicherung: Auswahl mit/ohne Passwort beim Erstellen, Passwortabfrage
  // beim Einspielen einer verschlüsselten Datei.
  const [exportDialogOffen, setExportDialogOffen] = useState(false);
  const [exportLaeuft, setExportLaeuft] = useState(false);
  const [passwortAbfrage, setPasswortAbfrage] = useState<{ dateiName: string; text: string } | null>(null);
  const [importFehler, setImportFehler] = useState<string | null>(null);
  const [importVorschau, setImportVorschau] = useState<{
    dateiName: string;
    text: string;
    kopf: SicherungsKopf;
    vergleich: BereichsVergleich[];
  } | null>(null);
  const [importLaeuft, setImportLaeuft] = useState(false);



  // External Link Confirmation Modal State (Requirement 5)
  const [externalLinkModal, setExternalLinkModal] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
    providerName: string;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Bug Reporting State
  const [bugSubject, setBugSubject] = useState('');
  const [bugArea, setBugArea] = useState('Dashboard (Übersicht)');
  const [bugDescription, setBugDescription] = useState('');
  const [bugSeverity, setBugSeverity] = useState<'normal' | 'low' | 'high' | 'critical'>('normal');
  const [bugContactName, setBugContactName] = useState('');
  const [bugContactEmail, setBugContactEmail] = useState('');
  const [bugIncludeSystemInfo, setBugIncludeSystemInfo] = useState(true);
  const [bugCopied, setBugCopied] = useState(false);
  const [isSubmittingBug, setIsSubmittingBug] = useState(false);
  const [bugSuccessMessage, setBugSuccessMessage] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<{ ticketId: string; timestamp: string; message: string; delivered: boolean } | null>(null);

  const generateBugReportText = () => {
    const severityLabels = {
      low: 'Niedrig (Schönheitsfehler / Tippfehler / Kosmetisch)',
      normal: 'Normal (Funktion fehlerhaft oder verhält sich unerwartet)',
      high: 'Hoch (Wichtige Funktion blockiert / beeinträchtigt)',
      critical: 'Kritisch (Datenverlust / Absturz / System blockiert)'
    };

    let report = `Hallo VereinsManager-Support-Team,\n\nich möchte folgendes Problem aus der VereinsManager-Anwendung melden:\n\n`;
    report += `==================================================\n`;
    report += `1. BEREICH / NAVIGATIONS-PUNKT:\n${bugArea}\n\n`;
    report += `2. BETREFF / KURZBESCHREIBUNG:\n${bugSubject.trim()}\n\n`;
    report += `3. SCHWEREGRAD / DRINGLICHKEIT:\n${severityLabels[bugSeverity]}\n\n`;
    report += `4. DETAILLIERTE BESCHREIBUNG DES PROBLEMS:\n${bugDescription.trim()}\n\n`;
    
    if (bugContactName.trim() || bugContactEmail.trim()) {
      report += `==================================================\n`;
      report += `5. KONTAKTDATEN FÜR RÜCKFRAGEN:\n`;
      if (bugContactName.trim()) report += `Name: ${bugContactName.trim()}\n`;
      if (bugContactEmail.trim()) report += `E-Mail: ${bugContactEmail.trim()}\n`;
      report += `\n`;
    }

    if (bugIncludeSystemInfo) {
      report += `==================================================\n`;
      report += `6. SYSTEM- & DIAGNOSE-DATEN:\n`;
      report += `- App-Version: v${CURRENT_APP_VERSION}\n`;
      report += `- Betriebsmodus: Lokaler Einzelplatz (IndexedDB)\n`;
      report += `- Zeitstempel: ${new Date().toLocaleString('de-DE')}\n`;
      report += `- Browser & Plattform: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Unbekannt'}\n`;
      report += `- Sprache: ${typeof navigator !== 'undefined' ? navigator.language : 'de-DE'}\n`;
      report += `- Bildschirmauflösung: ${typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight} px` : 'n/a'}\n`;
      report += `==================================================\n`;
    }

    report += `\n(Automatisch vorbereitet über VereinsManager Bugreporting)`;
    return report;
  };

  // Direct In-App Submission without requiring an external email program
  const handleDirectSubmitBugReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugSubject.trim()) {
      setStatusMsg({ type: 'error', text: 'Bitte geben Sie eine kurze Betreffzeile für das Problem an.' });
      return;
    }
    if (!bugDescription.trim()) {
      setStatusMsg({ type: 'error', text: 'Bitte beschreiben Sie das aufgetretene Problem im Freitextfeld.' });
      return;
    }

    setIsSubmittingBug(true);
    setBugSuccessMessage(null);

    const ticketId = `VM-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const timestamp = new Date().toLocaleString('de-DE');

    const clientInfo = bugIncludeSystemInfo
      ? `App v${CURRENT_APP_VERSION} | UA: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a'} | Screen: ${typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'n/a'}`
      : 'Keine Diagnosedaten';

    let sent = false;
    // Warum der Versand nicht geklappt hat — wird dem Anwender angezeigt, damit
    // er nicht raten muss.
    let failReason = '';
    // Was der Anwender dagegen tun kann.
    let failHint = '';

    try {
      // Versand direkt aus dem App-Fenster an den Mail-Dienst FormSubmit. Das
      // ist bewusst kein Weg über den lokalen Server: FormSubmit nimmt nur
      // Anfragen an, die aus einer Webseite kommen (Origin-Kopfzeile), und
      // weist Server-Anfragen ab.
      try {
        const formSubmitPayload = {
          _subject: `[VereinsManager #${ticketId} - ${bugArea}] ${bugSubject.trim()}`,
          _template: 'table',
          _captcha: 'false',
          Ticket_ID: ticketId,
          Bereich: bugArea,
          Betreff: bugSubject.trim(),
          Schweregrad: bugSeverity,
          Beschreibung: bugDescription.trim(),
          Absender_Name: bugContactName.trim() || 'Anonym / Nicht angegeben',
          Absender_Email: bugContactEmail.trim() || 'Keine Angabe',
          App_Version: `v${CURRENT_APP_VERSION}`,
          Betriebsmodus: 'Lokal',
          System_Info: clientInfo,
          Eingangszeit: timestamp,
        };

        const directRes = await fetch('https://formsubmit.co/ajax/vereinsmanager@ik.me', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(formSubmitPayload),
        });

        const rawDirect = await directRes.text();
        let directJson: any = null;
        try {
          directJson = JSON.parse(rawDirect);
        } catch {
          directJson = null;
        }

        if (directRes.ok && (directJson?.success === true || directJson?.success === 'true')) {
          sent = true;
        } else {
          failReason = directJson?.message || `Antwort des Mail-Dienstes: Status ${directRes.status}`;
        }
      } catch (directErr: any) {
        // Die Verbindung kam gar nicht zustande: kein Internet, oder ein Filter
        // im Netz (Router, Pi-hole, VPN) sperrt formsubmit.co.
        failReason = `Keine Verbindung zum Mail-Dienst (${directErr?.message || 'nicht erreichbar'})`;
        failHint =
          'Häufige Ursache: Ein Filter in Ihrem Netzwerk (z. B. Router wie die Fritzbox, Pi-hole oder ein VPN) blockiert die Adresse „formsubmit.co". Tragen Sie sie dort als Ausnahme ein oder prüfen Sie Ihre Internetverbindung.';
      }

      if (sent) {
        setSubmittedTicket({
          ticketId,
          timestamp,
          delivered: true,
          message: 'Ihr Fehlerbericht wurde an den Mail-Dienst übergeben.',
        });
        setBugSuccessMessage(`Fehlerbericht an den Mail-Dienst übergeben. Ticket-Nr: #${ticketId}`);
        setStatusMsg({
          type: 'success',
          text: `Fehlerbericht an den Mail-Dienst übergeben (Ticket #${ticketId}). Ob die Mail ankommt, lässt sich von hier aus nicht prüfen.`,
        });
      } else {
        // If neither method succeeded (e.g. completely offline in local mode or no internet access):
        // Gracefully register ticket locally and prompt the user to use 1-click email or clipboard
        setSubmittedTicket({
          ticketId,
          timestamp,
          delivered: false,
          message: `Der Bericht konnte NICHT direkt versendet werden${failReason ? `: ${failReason}` : '.'}${failHint ? ` ${failHint}` : ''} Bitte nutzen Sie bis dahin den Button "E-Mail-App" oder "Kopieren".`,
        });
        setStatusMsg({
          type: 'error',
          text: `Ticket #${ticketId} wurde nicht versendet${failReason ? ` (${failReason})` : ''}. Bitte den Bericht per E-Mail-App senden oder kopieren.`
        });
      }
    } catch (err: any) {
      console.error('Fehler bei Fehlerbericht-Verarbeitung:', err);
      const cleanMsg = err?.message && !err.message.includes('expected pattern')
        ? err.message
        : 'Offline-Modus aktiv';
      setStatusMsg({
        type: 'error',
        text: `Direkter Versand nicht möglich (${cleanMsg}). Bitte nutzen Sie den Button "E-Mail-App" oder "Kopieren".`
      });
    } finally {
      setIsSubmittingBug(false);
    }
  };

  // Fallback: Open local mail program
  const handleOpenInMailClient = () => {
    if (!bugSubject.trim()) {
      setStatusMsg({ type: 'error', text: 'Bitte geben Sie eine kurze Betreffzeile an.' });
      return;
    }
    if (!bugDescription.trim()) {
      setStatusMsg({ type: 'error', text: 'Bitte beschreiben Sie das aufgetretene Problem.' });
      return;
    }

    const emailTo = 'vereinsmanager@ik.me';
    const mailSubject = `[Bugreport - ${bugArea}] ${bugSubject.trim()}`;
    const mailBody = generateBugReportText();
    const mailtoUrl = `mailto:${emailTo}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
    
    window.location.href = mailtoUrl;
    setStatusMsg({
      type: 'success',
      text: 'Lokales E-Mail-Programm wurde mit dem Fehlerbericht geöffnet.'
    });
  };

  const handleCopyBugReport = async () => {
    if (!bugSubject.trim()) {
      setStatusMsg({ type: 'error', text: 'Bitte geben Sie mindestens eine Betreffzeile an.' });
      return;
    }
    if (!bugDescription.trim()) {
      setStatusMsg({ type: 'error', text: 'Bitte beschreiben Sie das Problem vor dem Kopieren.' });
      return;
    }

    const emailTo = 'vereinsmanager@ik.me';
    const mailSubject = `[Bugreport - ${bugArea}] ${bugSubject.trim()}`;
    const fullText = `An: ${emailTo}\nBetreff: ${mailSubject}\n\n${generateBugReportText()}`;
    
    try {
      await navigator.clipboard.writeText(fullText);
      setBugCopied(true);
      setTimeout(() => setBugCopied(false), 3500);
      setStatusMsg({
        type: 'success',
        text: 'Fehlerbericht in die Zwischenablage kopiert! Sie können den Text direkt in Ihre E-Mail einfügen.'
      });
    } catch (err) {
      // Häufigste Ursache: Der Browser gibt die Zwischenablage nur über
      // eine verschlüsselte Verbindung frei. Ohne diese Zeile bleibt das
      // im Dunkeln.
      console.warn('Zugriff auf die Zwischenablage fehlgeschlagen:', err);
      setStatusMsg({ type: 'error', text: 'Kopieren fehlgeschlagen. Bitte markieren Sie den Text manuell.' });
    }
  };

  const handleInsertTemplate = () => {
    const template = `1. Was habe ich getan? (Schritt-für-Schritt):\n- \n\n2. Was ist aufgetreten? (Fehlermeldung oder unerwartetes Verhalten):\n- \n\n3. Was wurde stattdessen erwartet?:\n- `;
    setBugDescription(prev => prev ? `${prev}\n\n${template}` : template);
  };

  const handleResetBugForm = () => {
    setBugSubject('');
    setBugArea('Dashboard (Übersicht)');
    setBugDescription('');
    setBugSeverity('normal');
    setBugSuccessMessage(null);
    setSubmittedTicket(null);
  };

  const handleChangeDevicePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevicePassword.trim()) {
      setUserMsg({ type: 'error', text: 'Bitte geben Sie ein neues Passwort ein.' });
      return;
    }
    if (newDevicePassword !== newDevicePasswordRepeat) {
      setUserMsg({ type: 'error', text: 'Die beiden Passwörter stimmen nicht überein.' });
      return;
    }
    try {
      const res = await AuthService.aendereBenutzerPasswort(newDevicePassword);
      if (!res.success) {
        setUserMsg({ type: 'error', text: res.message || 'Das Passwort konnte nicht geändert werden.' });
        return;
      }
      setNewDevicePassword('');
      setNewDevicePasswordRepeat('');
      setShowPassword(false);
      setUserMsg({ type: 'success', text: 'Das Passwort wurde geändert.' });
      setTimeout(() => setUserMsg(null), 3500);
    } catch (err: any) {
      setUserMsg({ type: 'error', text: err.message || 'Das Passwort konnte nicht geändert werden.' });
    }
  };

  const handleSaveClub = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingClub(true);
    setClubSaveSuccess(false);

    // Sync backwards-compatible chairman and treasurer fields for external services & reports
    const chairmanMember = boardMembers.find(bm => 
      bm.role.toLowerCase().includes('vorsitz') || bm.role.toLowerCase().includes('vorstand')
    ) || boardMembers[0];
    const treasurerMember = boardMembers.find(bm => 
      bm.role.toLowerCase().includes('kasse') || bm.role.toLowerCase().includes('schatz') || bm.role.toLowerCase().includes('finanz')
    ) || boardMembers[1] || boardMembers[0];

    const finalChairman = chairmanMember ? chairmanMember.name.trim() : (formData.chairman || '');
    const finalTreasurer = treasurerMember ? treasurerMember.name.trim() : (formData.treasurer || '');

    const formattedAddress = formatClubAddress(clubAddress);
    const updated: ClubSettings = {
      ...formData,
      address: formattedAddress,
      clubAddress: clubAddress,
      chairman: finalChairman,
      treasurer: finalTreasurer,
      boardMembers: boardMembers,
    };
    setFormData(updated);

    try {
      await onSaveSettings(updated);
      setIsSavingClub(false);
      setClubSaveSuccess(true);
      setClubSaveFeedbackText('Vereinsstammdaten erfolgreich gespeichert!');
      setStatusMsg({ type: 'success', text: 'Einstellungen & Vereinsstammdaten wurden erfolgreich gespeichert.' });

      setTimeout(() => {
        setClubSaveSuccess(false);
        setClubSaveFeedbackText(null);
      }, 4000);
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err: any) {
      setIsSavingClub(false);
      setStatusMsg({ type: 'error', text: err?.message || 'Fehler beim Speichern der Vereinsstammdaten.' });
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  // Board Members Handlers
  const handleAddBoardMember = () => {
    const newId = `bm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setBoardMembers(prev => [
      ...prev,
      {
        id: newId,
        role: '',
        name: '',
        email: '',
        phone: ''
      }
    ]);
  };

  const handleUpdateBoardMember = (id: string, field: keyof BoardMember, value: string) => {
    setBoardMembers(prev =>
      prev.map(bm => (bm.id === id ? { ...bm, [field]: value } : bm))
    );
  };

  const handleRemoveBoardMember = (id: string) => {
    if (boardMembers.length <= 1) {
      alert('Mindestens ein Vorstandsmitglied muss hinterlegt sein.');
      return;
    }
    setBoardMembers(prev => prev.filter(bm => bm.id !== id));
  };

  // Board Member Drag and Drop Handlers
  const handleBoardDragStart = (e: React.DragEvent, index: number) => {
    setDraggedBoardIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `board_${index}`);
  };

  const handleBoardDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedBoardIndex !== null && draggedBoardIndex !== index) {
      setDragOverBoardIndex(index);
    }
  };

  const handleBoardDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedBoardIndex === null || draggedBoardIndex === targetIndex) {
      setDraggedBoardIndex(null);
      setDragOverBoardIndex(null);
      return;
    }
    setBoardMembers(prev => {
      const next = [...prev];
      const [moved] = next.splice(draggedBoardIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDraggedBoardIndex(null);
    setDragOverBoardIndex(null);
  };

  const handleBoardDragEnd = () => {
    setDraggedBoardIndex(null);
    setDragOverBoardIndex(null);
  };

  // Hier standen zwei Funktionen, die Vorstandsposten und Sparten per Pfeil
  // nach oben und unten verschoben hätten. Sie waren fertig, aber es gab
  // keinen Knopf, der sie aufgerufen hätte — toter Code seit dem ersten Tag.
  // Bewusst entfernt statt fertiggebaut; wer die Sortierung will, findet den
  // Ansatz in der Versionsgeschichte (git log -S handleMoveBoardMember).

  // Department Drag and Drop Handlers
  const handleDeptDragStart = (e: React.DragEvent, index: number) => {
    setDraggedDeptIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `dept_${index}`);
  };

  const handleDeptDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedDeptIndex !== null && draggedDeptIndex !== index) {
      setDragOverDeptIndex(index);
    }
  };

  const handleDeptDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedDeptIndex === null || draggedDeptIndex === targetIndex) {
      setDraggedDeptIndex(null);
      setDragOverDeptIndex(null);
      return;
    }
    setFormData(prev => {
      const next = [...prev.departments];
      const [moved] = next.splice(draggedDeptIndex, 1);
      next.splice(targetIndex, 0, moved);
      return { ...prev, departments: next };
    });
    setDraggedDeptIndex(null);
    setDragOverDeptIndex(null);
  };

  const handleDeptDragEnd = () => {
    setDraggedDeptIndex(null);
    setDragOverDeptIndex(null);
  };


  const handleCopyLink = (url: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url);
      } else {
        const el = document.createElement('textarea');
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    }
  };

  const handleOpenExternalUrlConfirmed = async () => {
    if (!externalLinkModal) return;
    const targetUrl = externalLinkModal.url;
    setExternalLinkModal(null);
    await openExternalUrl(targetUrl);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMsg({ type: 'error', text: 'Bitte laden Sie eine Bilddatei hoch (PNG, JPG, SVG, WebP).' });
      setTimeout(() => setStatusMsg(null), 3500);
      return;
    }

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setStatusMsg({ type: 'error', text: 'Das Logo darf maximal 5 MB groß sein.' });
      setTimeout(() => setStatusMsg(null), 3500);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const updated = { ...formData, clubLogoUrl: result };
        setFormData(updated);
        onSaveSettings(updated);
        setStatusMsg({ type: 'success', text: 'Vereinslogo erfolgreich hochgeladen & als App-Logo übernommen!' });
        setTimeout(() => setStatusMsg(null), 3500);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    const updated = { ...formData, clubLogoUrl: undefined };
    setFormData(updated);
    onSaveSettings(updated);
    setStatusMsg({ type: 'success', text: 'Vereinslogo entfernt. Standard App-Logo wird wieder verwendet.' });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  const handleAddDepartment = () => {
    if (!newDepartment.trim()) return;
    if (formData.departments.includes(newDepartment.trim())) return;
    const updatedDepts = [...formData.departments, newDepartment.trim()];
    setFormData(prev => ({
      ...prev,
      departments: updatedDepts
    }));
    setNewDepartment('');
  };

  const handleRemoveDepartment = (dept: string) => {
    if (formData.departments.length <= 1) {
      alert('Mindestens eine Sparte/Abteilung muss vorhanden sein.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      departments: prev.departments.filter(d => d !== dept)
    }));
  };

  // Full Backup Export with destination folder selection.
  // Beide Knöpfe (Kopfzeile und Datensicherungs-Reiter) öffnen zuerst die
  // Auswahl "mit Passwort / ohne Passwort".
  const handleExportBackup = () => {
    setExportDialogOffen(true);
  };

  const fuehreExportAus = async (passwort: string | null) => {
    setExportLaeuft(true);
    try {
      const klartext = await StorageService.exportFullBackup();
      const inhalt = passwort ? await verschluessleSicherung(klartext, passwort) : klartext;
      const blob = new Blob([inhalt], { type: 'application/json' });
      const dateStr = new Date().toISOString().split('T')[0];
      const safeClub = (formData.clubName || 'Verein').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_');
      const filename = `VereinsManager_Sicherung_${safeClub}_${dateStr}${passwort ? '_verschluesselt' : ''}.json`;

      const result = await saveBlobWithLocationPicker(blob, filename, {
        description: passwort
          ? 'Verschlüsselte Datensicherungsdatei (*.json)'
          : 'JSON-Datensicherungsdatei (*.json)',
        mimeType: 'application/json',
        extension: '.json'
      });

      setExportDialogOffen(false);
      if (result.cancelled) {
        setStatusMsg({ type: 'info', text: 'Sicherung abgebrochen (kein Speicherort gewählt).' });
        setTimeout(() => setStatusMsg(null), 3000);
      } else if (result.success) {
        setStatusMsg({
          type: 'success',
          text:
            (result.method === 'picker'
              ? `Datensicherung erfolgreich gespeichert als: "${result.fileName}"`
              : `Datensicherung "${result.fileName}" erfolgreich gespeichert.`) +
            (passwort ? ' Sie ist mit Ihrem Passwort verschlüsselt.' : '')
        });
        setTimeout(() => setStatusMsg(null), 4500);
      } else {
        setStatusMsg({ type: 'error', text: result.error || 'Fehler beim Speichern der Sicherung.' });
        setTimeout(() => setStatusMsg(null), 4000);
      }
    } catch (err: any) {
      console.error('Fehler beim Export der Sicherung:', err);
      setExportDialogOffen(false);
      setStatusMsg({ type: 'error', text: err?.message || 'Fehler beim Erstellen der Sicherung.' });
      setTimeout(() => setStatusMsg(null), 4000);
    } finally {
      setExportLaeuft(false);
    }
  };

  // Full Backup Import
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Statt einer knappen Rückfrage ("Fortfahren?") wird die Datei erst
    // gelesen und mit dem vorhandenen Bestand abgeglichen. Der Dialog zeigt
    // dann, was tatsächlich passieren würde, und lässt die Wahl zwischen
    // Ersetzen und Ergänzen.
    try {
      const text = await file.text();
      if (istVerschluesselt(text)) {
        // Erst das Passwort abfragen; danach geht es wie bei jeder Sicherung weiter.
        setPasswortAbfrage({ dateiName: file.name, text });
        return;
      }
      const { kopf, vergleich } = await StorageService.analysiereSicherung(text);
      setImportVorschau({ dateiName: file.name, text, kopf, vergleich });
    } catch (err: any) {
      console.error('Sicherung konnte nicht gelesen werden:', err);
      setStatusMsg({
        type: 'error',
        text: err?.message || 'Die Datei konnte nicht gelesen werden.'
      });
    } finally {
      e.target.value = '';
    }
  };

  /** Gibt null bei Erfolg zurück, sonst die Fehlermeldung für den Dialog. */
  const entschluesseleSicherung = async (passwort: string): Promise<string | null> => {
    if (!passwortAbfrage) return 'Keine Datei ausgewählt.';
    try {
      const klartext = await entschluessleSicherung(passwortAbfrage.text, passwort);
      const { kopf, vergleich } = await StorageService.analysiereSicherung(klartext);
      setImportVorschau({ dateiName: passwortAbfrage.dateiName, text: klartext, kopf, vergleich });
      setPasswortAbfrage(null);
      return null;
    } catch (err: any) {
      return err?.message || 'Die Sicherung konnte nicht entschlüsselt werden.';
    }
  };

  const fuehreImportAus = async (art: ImportArt) => {
    if (!importVorschau) return;
    setImportLaeuft(true);
    setImportFehler(null);

    try {
      const result = await StorageService.importFullBackup(importVorschau.text, 'live', art);
      setImportVorschau(null);
      setImportFehler(null);
      onDataReload?.();
      const hinweisKopie = result.sicherheitskopie
        ? ''
        : ' Achtung: Die Sicherheitskopie des vorherigen Bestands konnte nicht angelegt werden.';
      setStatusMsg({
        type: 'success',
        text: `Sicherung erfolgreich ${art === 'ersetzen' ? 'eingespielt' : 'ergänzt'} (${result.membersCount} Mitglieder, ${result.transactionsCount} Buchungen).${hinweisKopie}`
      });
      setTimeout(() => setStatusMsg(null), 6000);
    } catch (err: any) {
      console.error('Fehler beim Import:', err);
      const isQuota = err?.name === 'QuotaExceededError' || (err?.message && err.message.toLowerCase().includes('quota'));
      // Im Dialog anzeigen (er bleibt offen), nicht in der Statusleiste dahinter.
      setImportFehler(
        isQuota
          ? 'Speicherplatz-Limit des Browsers überschritten. Bitte leeren Sie den Browser-Cache oder nutzen Sie die Desktop-App.'
          : `Fehler beim Import: ${err.message || 'Ungültige Datei'}`
      );
    } finally {
      setImportLaeuft(false);
    }
  };

  // Wipe All
  const handleWipeAll = async () => {
    if (window.confirm('ACHTUNG: Möchten Sie wirklich ALLE Mitglieder, Buchungen und Konten löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) {
      try {
        await StorageService.clearAllData();
        onDataReload?.();
        setStatusMsg({ type: 'success', text: 'Alle lokalen Daten wurden gelöscht.' });
      } catch (err: any) {
        console.error('Fehler beim Löschen aller Daten:', err);
        setStatusMsg({
          type: 'error',
          text: `Nicht alles konnte gelöscht werden: ${err?.message || 'unbekannter Fehler'}. Bitte erneut versuchen.`
        });
      }
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  // Auto-Snapshots: Zustand und Handler
  const [snapshots, setSnapshots] = useState<AutoSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [localStats, setLocalStats] = useState<{
    members: number;
    transactions: number;
    accounts: number;
    inventory: number;
    sepaRuns: number;
    documents: number;
    donations: number;
    calendarEvents: number;
    auditLogs: number;
  } | null>(null);

  const loadSnapshotsList = async () => {
    try {
      setLoadingSnapshots(true);
      const list = await SnapshotService.getSnapshots();
      setSnapshots(list);
    } catch (e) {
      console.warn('Snapshots konnten nicht geladen werden:', e);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  const loadLocalStats = async () => {
    try {
      const stats = await StorageService.getLocalDataStats();
      setLocalStats(stats);
    } catch (e) {
      console.warn('Fehler beim Laden der lokalen Statistiken:', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'backup') {
      loadSnapshotsList();
      loadLocalStats();
    }
  }, [activeTab]);

  const handleCreateManualSnapshot = async () => {
    try {
      const snap = await SnapshotService.createSnapshot('manual', 'Manuell gesicherter Snapshot');
      if (snap) {
        setStatusMsg({ type: 'success', text: 'Manueller Sicherheits-Snapshot wurde erfolgreich erstellt.' });
        loadSnapshotsList();
      } else {
        setStatusMsg({ type: 'error', text: 'Keine Daten vorhanden, die gesichert werden können.' });
      }
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (e: any) {
      // Datensicherung: Hier die Ursache zu verschlucken ist besonders
      // misslich — wer nicht weiss, warum die Sicherung scheitert, kann
      // es auch nicht abstellen.
      console.error('Datensicherung konnte nicht erstellt werden:', e);
      setStatusMsg({ type: 'error', text: 'Fehler beim Erstellen des Snapshots.' });
    }
  };

  const handleRestoreSnapshot = async (snapId: string, label: string) => {
    if (!window.confirm(`Möchten Sie diesen Snapshot ("${label}") wirklich wiederherstellen? Aktuelle Daten werden auf diesen Stand zurückgesetzt.`)) {
      return;
    }
    try {
      const res = await SnapshotService.restoreSnapshot(snapId);
      if (res.success && res.counts) {
        onDataReload?.();
        setStatusMsg({
          type: 'success',
          text: `Snapshot erfolgreich wiederhergestellt (${res.counts.membersCount} Mitglieder, ${res.counts.transactionsCount} Buchungen, ${res.counts.contactsCount} Kontakte)!`
        });
        loadSnapshotsList();
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Wiederherstellung fehlgeschlagen.' });
      }
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (e: any) {
      console.error('Wiederherstellung aus der Datensicherung fehlgeschlagen:', e);
      setStatusMsg({ type: 'error', text: 'Fehler bei der Wiederherstellung.' });
    }
  };

  const handleDeleteSnapshot = async (snapId: string) => {
    if (!window.confirm('Möchten Sie diesen Snapshot wirklich löschen?')) return;
    await SnapshotService.deleteSnapshot(snapId);
    loadSnapshotsList();
  };

  // Theme selection handler
  const handleSelectTheme = (theme: 'light' | 'dark' | 'system') => {
    onThemeChange(theme);
    setFormData(prev => ({ ...prev, theme }));
    onSaveSettings({ ...formData, theme });
    setStatusMsg({
      type: 'success',
      text: `Designmodus auf "${theme === 'dark' ? 'Dunkel (Dark Mode)' : theme === 'light' ? 'Hell (Light Mode)' : 'System'}" gesetzt.`
    });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  // Farbschema und Schrift: gelten für den ganzen Verein, werden mit den
  // Vereinsdaten gespeichert und sofort angewendet (App.tsx).
  const handleSelectColorScheme = (colorScheme: ColorSchemeId) => {
    setFormData(prev => ({ ...prev, colorScheme }));
    onSaveSettings({ ...formData, colorScheme });
    const name = COLOR_SCHEMES.find(c => c.id === colorScheme)?.name || colorScheme;
    setStatusMsg({ type: 'success', text: `Farbschema auf "${name}" gesetzt.` });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleSelectFont = (fontChoice: FontChoiceId) => {
    setFormData(prev => ({ ...prev, fontChoice }));
    onSaveSettings({ ...formData, fontChoice });
    const name = FONT_CHOICES.find(f => f.id === fontChoice)?.name || fontChoice;
    setStatusMsg({ type: 'success', text: `Schriftart auf "${name}" gesetzt.` });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const activeColorScheme = formData.colorScheme || DEFAULT_COLOR_SCHEME;
  const activeFont = formData.fontChoice || DEFAULT_FONT_CHOICE;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">

      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-600 dark:bg-blue-500 text-white rounded-2xl shadow-sm">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Systemeinstellungen
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Konfigurieren Sie Erscheinungsbild, Vereinsstammdaten, Passwort und Backups.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Schnell-Backup</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation with exact requested sequence */}
        <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 gap-1 sm:gap-2 pt-6 text-xs font-bold text-slate-600 dark:text-slate-400">
          {/* 1. Allgemeine Einstellungen */}
          <button
            type="button"
            onClick={() => switchTab('general')}
            className={`pb-3.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>1. Allgemeine Einstellungen</span>
          </button>

          {/* 2. Vereinsstammdaten */}
          <button
            type="button"
            onClick={() => switchTab('club')}
            className={`pb-3.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'club'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>2. Vereinsstammdaten</span>
          </button>

          {/* 3. Datensicherung und Import */}
          <button
            type="button"
            onClick={() => switchTab('backup')}
            className={`pb-3.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'backup'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>3. Datensicherung und Import</span>
          </button>

          {/* 4. Projekt unterstützen */}
          <button
            type="button"
            onClick={() => switchTab('support')}
            className={`pb-3.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'support'
                ? 'border-rose-500 text-rose-600 dark:text-rose-400 dark:border-rose-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Heart className={`w-4 h-4 ${activeTab === 'support' ? 'text-rose-500 fill-rose-500' : 'text-rose-400'}`} />
            <span>4. Projekt unterstützen</span>
          </button>

          {/* 5. Problem melden (Bugreporting) */}
          <button
            type="button"
            onClick={() => switchTab('bugreport')}
            className={`pb-3.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'bugreport'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400 dark:border-amber-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Bug className="w-4 h-4 text-amber-500" />
            <span>5. Problem melden</span>
          </button>
        </div>
      </div>

      {/* Status & Feedback Toast Message */}
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 animate-in fade-in duration-200 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
              : statusMsg.type === 'info'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : statusMsg.type === 'info' ? (
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* TAB 1: ALLGEMEINE EINSTELLUNGEN (inkl. Dark Mode Funktion) */}
      {activeTab === 'general' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Dark Mode & Erscheinungsbild Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-800/60">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Erscheinungsbild & Dark Mode
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Wählen Sie zwischen hellem Modus, augenfreundlichem Dunkelmodus oder automatischer Anpassung.
                  </p>
                </div>
              </div>
            </div>

            {/* 3 Theme Choice Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              {/* Light Theme */}
              <button
                type="button"
                onClick={() => handleSelectTheme('light')}
                className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  currentTheme === 'light'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-amber-100 text-amber-800 rounded-xl dark:bg-amber-900/40 dark:text-amber-200">
                      <Sun className="w-4 h-4" />
                    </div>
                    {currentTheme === 'light' && (
                      <span className="p-1 bg-blue-600 text-white rounded-full">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Heller Modus (Light)
                  </h4>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                    Klassisches helles Design mit klaren Kontrasten, optimal für helle Räume und Tageslicht.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Standard-Ansicht</span>
                </div>
              </button>

              {/* Dark Theme */}
              <button
                type="button"
                onClick={() => handleSelectTheme('dark')}
                className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  currentTheme === 'dark'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl">
                      <Moon className="w-4 h-4" />
                    </div>
                    {currentTheme === 'dark' && (
                      <span className="p-1 bg-blue-600 text-white rounded-full">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Dunkler Modus (Dark)
                  </h4>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                    Augenschonendes Nacht-Design mit tiefen Schieferfarben für ermüdungsfreies Arbeiten.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span>Augenschonend</span>
                </div>
              </button>

              {/* System Theme */}
              <button
                type="button"
                onClick={() => handleSelectTheme('system')}
                className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  currentTheme === 'system'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl">
                      <Laptop className="w-4 h-4" />
                    </div>
                    {currentTheme === 'system' && (
                      <span className="p-1 bg-blue-600 text-white rounded-full">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    System-Standard (Auto)
                  </h4>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                    Übernimmt automatisch die Hell-/Dunkel-Einstellung Ihres Betriebssystems oder Browsers.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Automatisch synchron</span>
                </div>
              </button>
            </div>

            {/* Farbschema */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Farbschema</h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Die Hauptfarbe der Anwendung. Gilt für den ganzen Verein und wird mit den Vereinsdaten gespeichert.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="group" aria-label="Farbschema">
                {COLOR_SCHEMES.map(scheme => {
                  const active = activeColorScheme === scheme.id;
                  return (
                    <button
                      key={scheme.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleSelectColorScheme(scheme.id)}
                      className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col gap-2 cursor-pointer ${
                        active
                          ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex h-6 rounded-md overflow-hidden">
                        {scheme.swatch.map((farbe, i) => (
                          <span key={i} className="flex-1" style={{ backgroundColor: farbe }} />
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{scheme.name}</span>
                        {active && <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white" />}
                      </div>
                      <span className="text-2xs text-slate-500 dark:text-slate-400">{scheme.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Schriftart */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Schriftart</h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gilt für die Bildschirmansicht. PDF-Dokumente (Bescheinigungen, Rechnungen, Berichte) behalten ihre eigene Schrift.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" role="group" aria-label="Schriftart">
                {FONT_CHOICES.map(font => {
                  const active = activeFont === font.id;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleSelectFont(font.id)}
                      className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
                        active
                          ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white" style={{ fontFamily: font.family }}>
                          {font.name}
                        </span>
                        {active && <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white" />}
                      </div>
                      <span className="text-xs text-slate-600 dark:text-slate-300" style={{ fontFamily: font.family }}>
                        Mitglieder 1.234,56 € – Größe, Übung, Ärger
                      </span>
                      <span className="text-2xs text-slate-500 dark:text-slate-400">{font.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* General Preferences & Form */}
          <form onSubmit={handleSaveClub} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Regionale Anzeige & Standardeinstellungen
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Währung, Datumsformate und Standardwerte für die tägliche Vereinsarbeit.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hauptwährung
                </label>
                <select
                  value={formData.currency || 'EUR'}
                  onChange={e => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="EUR">Euro (€ - EUR)</option>
                  <option value="CHF">Schweizer Franken (CHF)</option>
                  <option value="USD">US Dollar ($ - USD)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Datumsformat
                </label>
                <select
                  value={formData.dateFormat || 'DD.MM.YYYY'}
                  onChange={e => setFormData({ ...formData, dateFormat: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DD.MM.YYYY">TT.MM.JJJJ (z.B. 28.08.2026)</option>
                  <option value="YYYY-MM-DD">JJJJ-MM-TT (z.B. 2026-08-28)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Geschäftsjahresbeginn
                </label>
                <select
                  value={formData.fiscalYearStart || '01-01'}
                  onChange={e => setFormData({ ...formData, fiscalYearStart: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="01-01">01. Januar (Kalenderjahr)</option>
                  <option value="07-01">01. Juli (Saisonjahr Sport)</option>
                  <option value="10-01">01. Oktober (Herbststart)</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Automatische Sperre bei Inaktivität
              </label>
              <select
                value={autoLockMinutes}
                onChange={e => handleAutoLockChange(Number(e.target.value))}
                className="w-full sm:w-72 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>Nie automatisch sperren</option>
                {(AUTO_LOCK_CHOICES.includes(autoLockMinutes) || autoLockMinutes <= 0
                  ? AUTO_LOCK_CHOICES
                  : [...AUTO_LOCK_CHOICES, autoLockMinutes].sort((a, b) => a - b)
                ).map(min => (
                  <option key={min} value={min}>
                    Nach {min >= 60 ? `${min / 60} ${min === 60 ? 'Stunde' : 'Stunden'}` : `${min} Minuten`}
                    {min === 15 ? ' (Standard)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Gilt nur für dieses Gerät und wird sofort übernommen. Ohne automatische Sperre
                bleibt die App an einem unbeaufsichtigten Rechner offen, bis jemand sie von Hand sperrt.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Allgemeine Einstellungen speichern"
              >
                Allgemeine Einstellungen speichern
              </button>
            </div>
          </form>

          {/* Passwort dieses Geräts */}
          {/* Was der Passwortschutz im lokalen Betrieb leistet — und was nicht.
              Ohne diesen Hinweis hält ein Verein die Anmeldung leicht für einen
              Schutz der Daten, der sie nicht ist. */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 flex items-start gap-3">
            <Lock className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed space-y-1.5">
              <p>
                <strong>Das Passwort</strong> wird nicht im Klartext gespeichert, sondern nur
                als Prüfwert, aus dem sich das Passwort nicht zurückrechnen lässt. Es gehört zu
                diesem Gerät und reist nicht mit einer Datensicherung mit.
              </p>
              <p>
                <strong>Die Vereinsdaten selbst</strong> — Mitglieder, Bankverbindungen,
                Kassenbuch — liegen auf diesem Gerät unverschlüsselt. Wer an den Rechner
                kommt, kommt an die Daten, auch ohne Passwort. Die Anmeldung schützt nur gegen
                einen zufälligen Blick an einem unbeaufsichtigten, entsperrten Gerät; sie
                ersetzt keinen Schutz des Geräts selbst. Dafür sorgt die
                Festplattenverschlüsselung Ihres Betriebssystems (Windows: BitLocker bzw.
                „Geräteverschlüsselung"), und ein Bildschirmschoner mit Kennwort.
              </p>
            </div>
          </div>

          {/* Feedback Alert if present */}
          {userMsg && (
            <div
              className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 animate-in fade-in ${
                userMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
              }`}
            >
              {userMsg.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{userMsg.text}</span>
            </div>
          )}

          <form
            onSubmit={handleChangeDevicePassword}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
                <UserIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Passwort ändern
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Es gibt genau ein Passwort für dieses Gerät. Jeder, der sich anmeldet, hat
                  vollen Zugriff — es gibt keine einzelnen Benutzerkonten oder Bereichsrechte
                  mehr.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Neues Passwort
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newDevicePassword}
                    onChange={(e) => setNewDevicePassword(e.target.value)}
                    placeholder="Sicheres Passwort vergeben..."
                    required
                    className="w-full px-3.5 py-2 pr-10 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Neues Passwort wiederholen
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newDevicePasswordRepeat}
                  onChange={(e) => setNewDevicePasswordRepeat(e.target.value)}
                  placeholder="Zur Kontrolle erneut eingeben"
                  required
                  className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                title="Passwort ändern"
              >
                Passwort ändern
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: VEREINSSTAMMDATEN */}
      {activeTab === 'club' && (
        <form onSubmit={handleSaveClub} className="space-y-5 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Offizielle Vereinsstammdaten
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Diese Angaben erscheinen auf Anträgen, Spendenquittungen, Rechnungen und im SEPA-Lastschriftlauf.
              </p>
            </div>
          </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  {/* Logo Preview Avatar */}
                  <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden shrink-0 shadow-xs p-1">
                    <img
                      src={formData.clubLogoUrl || '/logo_transparent.png'}
                      alt="Vereinslogo Vorschau"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        if (e.currentTarget.src !== window.location.origin + '/logo_transparent.png') {
                          e.currentTarget.src = '/logo_transparent.png';
                        }
                      }}
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        Vereinswappen & Logo
                      </h4>
                      {formData.clubLogoUrl ? (
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-md text-[10px] font-bold border border-emerald-300/60 dark:border-emerald-800/60">
                          Eigenes Logo aktiv
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md text-[10px] font-bold border border-blue-200 dark:border-blue-800/60">
                          Standard-Logo
                        </span>
                      )}
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                      Ersetzt das Standard-Logo oben links in der Menüleiste neben dem Schriftzug „VereinsManager“. Unterstützt PNG, JPG, SVG und WebP (max. 5 MB).
                    </p>
                  </div>
                </div>

                {/* Upload & Remove Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <label className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{formData.clubLogoUrl ? 'Logo ändern' : 'Logo hochladen'}</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  {formData.clubLogoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="px-3 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Eigenes Logo entfernen & Standard wiederherstellen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Entfernen</span>
                    </button>
                  )}
                </div>
              </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Vereinsname &amp; Vereinsanschrift</h3>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Offizieller Vereinsname *
              </label>
              <input
                type="text"
                required
                value={formData.clubName}
                onChange={e => setFormData({ ...formData, clubName: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. TSV Musterstadt 1890 e.V."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-2">Offizielle Vereinsanschrift (Geschäftsstelle / Sitz)</label>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Straße *
                  </label>
                  <input
                    type="text"
                    value={clubAddress.street}
                    onChange={e => setClubAddress({ ...clubAddress, street: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. Sportplatzweg"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Hausnummer *
                  </label>
                  <input
                    type="text"
                    value={clubAddress.houseNumber}
                    onChange={e => setClubAddress({ ...clubAddress, houseNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. 12 a"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Postleitzahl (PLZ) *
                  </label>
                  <input
                    type="text"
                    value={clubAddress.zip}
                    onChange={e => setClubAddress({ ...clubAddress, zip: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. 12345"
                  />
                </div>
                <div className="sm:col-span-8">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Stadt / Ort *
                  </label>
                  <input
                    type="text"
                    value={clubAddress.city}
                    onChange={e => setClubAddress({ ...clubAddress, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. Musterstadt"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Kontaktdaten des Vereins</h3>
              </div>
            </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Zentrale Kontakt-E-Mail
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="kontakt@tsv-musterstadt.de"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Telefonnummer Geschäftsstelle
                  </label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+49 (0) 1234 56789"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vereins-Website
                  </label>
                  <input
                    type="url"
                    value={formData.website || ''}
                    onChange={e => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://www.tsv-musterstadt1890.de"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Vorstand & Vertretungsberechtigte</span>
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-md text-[10px] font-bold">
                        {boardMembers.length} {boardMembers.length === 1 ? 'Mitglied' : 'Mitglieder'}
                      </span>
                    </h4>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Legen Sie alle Vorstandsmitglieder an und benennen Sie deren Ämter frei.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddBoardMember}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Neues Vorstandsmitglied anlegen</span>
                </button>
              </div>

              {/* List of Board Members */}
              <div
                onDragOver={e => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDragEnter={e => e.preventDefault()}
                className="space-y-3"
              >
                {boardMembers.map((bm, idx) => {
                  const isDragging = draggedBoardIndex === idx;
                  const isDragOver = dragOverBoardIndex === idx;

                  return (
                  <div
                    key={bm.id}
                    draggable
                    onDragStart={e => handleBoardDragStart(e, idx)}
                    onDragOver={e => handleBoardDragOver(e, idx)}
                    onDragEnter={e => {
                      e.preventDefault();
                      if (draggedBoardIndex !== null && draggedBoardIndex !== idx) {
                        setDragOverBoardIndex(idx);
                      }
                    }}
                    onDrop={e => handleBoardDrop(e, idx)}
                    onDragEnd={handleBoardDragEnd}
                    className={`p-3.5 bg-white dark:bg-slate-900 border rounded-xl shadow-2xs space-y-3 transition-all ${
                      isDragging
                        ? 'opacity-40 border-dashed border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                        : isDragOver
                        ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50 dark:bg-blue-950/60 scale-[1.01]'
                        : 'border-slate-200 dark:border-slate-750 hover:border-slate-350 dark:hover:border-slate-650'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 select-none"
                          title="Ziehen zum Neuanordnen per Drag & Drop"
                        >
                          <GripVertical className="w-4 h-4 pointer-events-none" />
                        </div>
                        <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono font-bold flex items-center justify-center select-none pointer-events-none">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white select-none">
                          {bm.role || 'Neues Vorstandsamt'} {bm.name ? `– ${bm.name}` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveBoardMember(bm.id)}
                          className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors ml-1"
                          title="Vorstandsmitglied entfernen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-4">
                        <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          Funktion / Amtsbezeichnung *
                        </label>
                        <input
                          type="text"
                          value={bm.role}
                          onChange={e => handleUpdateBoardMember(bm.id, 'role', e.target.value)}
                          placeholder="z.B. 1. Vorsitzender, Sportwart, Schriftführer"
                          className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          Vollständiger Name *
                        </label>
                        <input
                          type="text"
                          value={bm.name}
                          onChange={e => handleUpdateBoardMember(bm.id, 'name', e.target.value)}
                          placeholder="Vor- und Nachname"
                          className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          E-Mail (optional)
                        </label>
                        <input
                          type="email"
                          value={bm.email || ''}
                          onChange={e => handleUpdateBoardMember(bm.id, 'email', e.target.value)}
                          placeholder="name@verein.de"
                          className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          Telefon (optional)
                        </label>
                        <input
                          type="tel"
                          value={bm.phone || ''}
                          onChange={e => handleUpdateBoardMember(bm.id, 'phone', e.target.value)}
                          placeholder="+49 170..."
                          className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Quick suggestion chips for role if empty */}
                    {!bm.role && (
                      <div className="flex flex-wrap items-center gap-1 pt-1 text-[11px] text-slate-400">
                        <span className="text-[10px] font-medium mr-1">Vorschläge:</span>
                        {['1. Vorsitzender', '2. Vorsitzender', 'Schatzmeister', 'Kassenwart', 'Schriftführer', 'Sportwart', 'Jugendleiter', 'Beisitzer'].map(suggestion => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => handleUpdateBoardMember(bm.id, 'role', suggestion)}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-blue-900/40 text-slate-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300 rounded-md text-[10px] border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                          >
                            + {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Steuerliche Angaben</h3>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Vereinsregisternummer (VR-Nr.)
              </label>
              <input
                type="text"
                value={formData.associationNumber}
                onChange={e => setFormData({ ...formData, associationNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. VR 48219 Amtsgericht Musterstadt"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Steuernummer (Finanzamt)
              </label>
              <input
                type="text"
                value={formData.taxNumber}
                onChange={e => setFormData({ ...formData, taxNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. 112/5840/1922"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Zuständiges Finanzamt
              </label>
              <input
                type="text"
                value={formData.taxOffice || ''}
                onChange={e => setFormData({ ...formData, taxOffice: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. Finanzamt Musterstadt"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Datum Freistellungsbescheid
              </label>
              <input
                type="text"
                value={formData.taxExemptionDate || ''}
                onChange={e => setFormData({ ...formData, taxExemptionDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. 15.03.2024"
              />
            </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-300">
                <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>SEPA-Gläubiger- & Vereinskonto-Stammdaten</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Diese Angaben werden als Gläubiger (Creditor) in die offiziellen SEPA XML-Dateien (pain.008) für Ihre Bank eingebettet.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gläubiger-ID (CI) *
                  </label>
                  <input
                    type="text"
                    value={formData.creditorId}
                    onChange={e => setFormData({ ...formData, creditorId: e.target.value.toUpperCase().trim() })}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="DE98ZZZ09999999999"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vereins-IBAN (Gutschrift) *
                  </label>
                  <input
                    type="text"
                    value={formatIbanWithSpaces(formData.creditorIban || '')}
                    onChange={e => {
                      const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                      setFormData({ ...formData, creditorIban: clean });
                    }}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 tracking-wider"
                    placeholder="DE89 3705 0198 0000 0123 45"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vereins-BIC / SWIFT
                  </label>
                  <input
                    type="text"
                    value={formData.creditorBic || ''}
                    onChange={e => setFormData({ ...formData, creditorBic: e.target.value.toUpperCase().trim() })}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="BYLADEM1001"
                  />
                </div>
              </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Abteilungen & Sparten ({formData.departments.length})</span>
                </label>
                <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ziehen Sie Sparten per Drag & Drop mit der Maus, um die Reihenfolge festzulegen. Diese Reihenfolge wird in Formularen und Dropdowns verwendet.
                </p>
              </div>

              {/* Add New Department Form Inline */}
              <div className="flex gap-2 max-w-sm w-full sm:w-auto">
                <input
                  type="text"
                  value={newDepartment}
                  onChange={e => setNewDepartment(e.target.value)}
                  placeholder="Neue Sparte (z. B. Badminton)"
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white flex-1 focus:ring-2 focus:ring-blue-500"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddDepartment();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddDepartment}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0 flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Hinzufügen</span>
                </button>
              </div>
            </div>

            {/* Drag and drop department list */}
            <div
              onDragOver={e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDragEnter={e => e.preventDefault()}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1"
            >
              {formData.departments.map((dept, index) => {
                const isDragging = draggedDeptIndex === index;
                const isDragOver = dragOverDeptIndex === index;

                return (
                  <div
                    key={dept}
                    draggable
                    onDragStart={e => handleDeptDragStart(e, index)}
                    onDragOver={e => handleDeptDragOver(e, index)}
                    onDragEnter={e => {
                      e.preventDefault();
                      if (draggedDeptIndex !== null && draggedDeptIndex !== index) {
                        setDragOverDeptIndex(index);
                      }
                    }}
                    onDrop={e => handleDeptDrop(e, index)}
                    onDragEnd={handleDeptDragEnd}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all select-none ${
                      isDragging
                        ? 'opacity-40 border-dashed border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                        : isDragOver
                        ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50 dark:bg-blue-950/60 scale-[1.02]'
                        : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 select-none"
                        title="Ziehen zum Neuanordnen per Drag & Drop"
                      >
                        <GripVertical className="w-4 h-4 pointer-events-none" />
                      </div>
                      <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 pointer-events-none">
                        {index + 1}
                      </span>
                      <span className="text-xs font-semibold text-slate-900 dark:text-white truncate pointer-events-none">
                        {dept}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveDepartment(dept)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors ml-0.5"
                        title="Sparte entfernen"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
          <div className="pt-5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Inline Feedback Banner directly in view of the user */}
            <div className="flex-1">
              {clubSaveFeedbackText && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold block">Erfolgreich gespeichert!</span>
                    <span className="text-2xs text-emerald-700 dark:text-emerald-300">
                      {clubSaveFeedbackText} Alle Änderungen an Vorstand, Sparten und Stammdaten sind gesichert.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Save Button with Interactive Feedback & Spinner */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="submit"
                disabled={isSavingClub}
                className={`px-6 py-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer ${
                  clubSaveSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400/60 shadow-emerald-600/20'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                title="Vereinsstammdaten speichern"
              >
                {isSavingClub ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Wird gespeichert...</span>
                  </>
                ) : clubSaveSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Vereinsstammdaten erfolgreich gespeichert!</span>
                  </>
                ) : (
                  <>
                    <Building className="w-4 h-4" />
                    <span>Vereinsstammdaten speichern</span>
                  </>
                )}
              </button>
            </div>
          </div>
          </div>
        </form>
      )}

      {/* TAB 4: DATENSICHERUNG UND IMPORT */}
      {activeTab === 'backup' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Datensicherung & Wiederherstellung
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Erstellen Sie Sicherungskopien aller Vereinsdaten oder stellen Sie einen früheren Stand wieder her.
                </p>
              </div>
            </div>

            {/* Active Protection Banner */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-start gap-3.5">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  Automatischer Update-Schutz & Datensicherheit aktiv
                </h4>
                <p className="text-2xs sm:text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  Ihre Daten sind vor und nach Versions-Updates optimal geschützt. Bei jedem App-Start und vor Aktualisierungen werden isolierte Sicherheits-Snapshots in einer geschützten Datenbank angelegt. Ein unbeabsichtigtes Überschreiben bei Updates ist technisch ausgeschlossen.
                </p>
              </div>
            </div>

            {/* Automatic Snapshots Section */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-800/40 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-xl">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      Automatische Sicherheits-Snapshots
                    </h4>
                    <p className="text-2xs text-slate-500 dark:text-slate-400">
                      Rollback-Punkte für den Fall, dass Sie auf einen früheren Stand zurückkehren möchten.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCreateManualSnapshot}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-2xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Jetzt Snapshot anlegen</span>
                  </button>
                  <button
                    type="button"
                    onClick={loadSnapshotsList}
                    className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Snapshots neu laden"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingSnapshots ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {snapshots.length === 0 ? (
                <div className="p-6 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Archive className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Noch keine Snapshots gespeichert. Sobald Daten eingegeben werden, legt das System automatisch Sicherungen an.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {snapshots.map(snap => {
                    const date = new Date(snap.timestamp);
                    const formattedDate = date.toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div
                        key={snap.id}
                        className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              {snap.label}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-3xs font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              v{snap.version}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {formattedDate}
                            </span>
                            <span>•</span>
                            <span>{snap.summary.membersCount} Mitglieder</span>
                            <span>•</span>
                            <span>{snap.summary.transactionsCount} Buchungen</span>
                            {snap.summary.contactsCount > 0 && (
                              <>
                                <span>•</span>
                                <span>{snap.summary.contactsCount} Kontakte</span>
                              </>
                            )}
                            {snap.summary.invoicesCount > 0 && (
                              <>
                                <span>•</span>
                                <span>{snap.summary.invoicesCount} Rechnungen</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRestoreSnapshot(snap.id, snap.label)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-2xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Wiederherstellen</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSnapshot(snap.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Snapshot löschen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Aktueller lokaler Datenbestand */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Aktueller lokaler Datenbestand auf diesem Gerät</span>
                </h4>
                <button
                  type="button"
                  onClick={loadLocalStats}
                  className="text-2xs text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer dark:text-slate-400"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Aktualisieren</span>
                </button>
              </div>

              {localStats ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <div className="text-slate-500 dark:text-slate-400 text-2xs">Mitglieder</div>
                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{localStats.members}</div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <div className="text-slate-500 dark:text-slate-400 text-2xs">Buchungen</div>
                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{localStats.transactions}</div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <div className="text-slate-500 dark:text-slate-400 text-2xs">Finanzkonten</div>
                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{localStats.accounts}</div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <div className="text-slate-500 dark:text-slate-400 text-2xs">Inventar</div>
                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{localStats.inventory}</div>
                  </div>
                </div>
              ) : (
                <div className="text-2xs text-slate-400">Statistiken werden geladen...</div>
              )}

              <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Diese Daten liegen ausschließlich auf diesem Gerät. Die Sicherung unten ist die einzige Möglichkeit, sie vor einem Geräteverlust oder -defekt zu schützen.
              </p>
            </div>

            {/* Export Backup Card */}
            <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Vollständige Datensicherung herunterladen (JSON)</span>
                </h4>
                <p className="text-2xs sm:text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                  Exportiert alle Mitglieder, Kassenbuchungen, Belegdateien, Konten, Spendenquittungen, Anträge und Revisionsprotokolle in eine JSON-Datei — auf Wunsch mit Passwort verschlüsselt, sodass sie sich ohne dieses Passwort nicht lesen lässt.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportBackup}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Sicherung herunterladen</span>
              </button>
            </div>

            {/* Import Backup Card */}
            <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Datensicherung wiederherstellen (JSON)</span>
                </h4>
                <p className="text-2xs sm:text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                  Spielt eine zuvor erstellte JSON-Sicherungsdatei wieder in die lokale IndexedDB Ihres Browsers ein.
                </p>
              </div>
              <div className="relative shrink-0">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
                <div className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Sicherung einspielen</span>
                </div>
              </div>
            </div>

            {/* Database Danger Zone */}
            <div className="border border-rose-200 dark:border-rose-900/60 rounded-2xl p-5 bg-rose-50/50 dark:bg-rose-950/20 space-y-4">
              <h4 className="text-xs font-bold text-rose-900 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Alle lokalen Daten löschen</span>
              </h4>
              <p className="text-2xs text-rose-800 dark:text-rose-300">
                Löscht den gesamten lokalen Datenbestand dieses Geräts vollständig: Mitglieder, Buchungen, Belege, Vereinsstammdaten, Vorlagen und alle automatischen Sicherheitskopien. Das Gerätepasswort bleibt erhalten.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleWipeAll}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Alle lokalen Daten löschen</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PROJEKT UNTERSTÜTZEN & SPENDEN */}
      {activeTab === 'support' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Header Banner */}
          <div className="bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-amber-500/10 dark:from-rose-950/40 dark:via-slate-900 dark:to-amber-950/20 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="p-3.5 bg-rose-500 text-white rounded-2xl shadow-md shadow-rose-500/20 shrink-0">
                  <Heart className="w-7 h-7 fill-white/20" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 mb-2">
                    <Sparkles className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                    <span>Gemeinnützige Software & Open-Source-Initiative</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Projekt & Weiterentwicklung unterstützen
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    VereinsManager wurde entwickelt, um Vereinen, Vorständen und Ehrenamtlichen eine moderne, DSGVO-konforme und kostenfreie Verwaltungssoftware an die Hand zu geben. Ihre freiwillige finanzielle Unterstützung sichert die kontinuierliche Pflege und künftige Erweiterungen.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid: QR-Code Card + Info Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Liberapay QR Code Card (5 cols) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col items-center text-center space-y-5">
              <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-white">
                    Liberapay Spenden-QR-Code
                  </span>
                </div>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Direkt & Sicher
                </span>
              </div>

              {/* Embedded QR Code Image - Size matched to frame and Clickable with Zoom Preview */}
              <div
                onClick={() => setQrModalOpen(true)}
                className="w-full max-w-[280px] sm:max-w-[320px] aspect-square bg-white rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm relative group cursor-pointer overflow-hidden p-2 flex items-center justify-center transition-all duration-200 hover:border-blue-500 hover:shadow-md dark:bg-slate-900"
                title="Klicken, um den QR-Code vergrößert anzuzeigen"
              >
                <img
                  src={projectSupportQrUrl ?? undefined}
                  alt="Liberapay QR Code zur finanziellen Projektunterstützung"
                  className="w-full h-full object-contain rounded-xl select-none pointer-events-none"
                />

                {/* Hover Overlay Badge */}
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-white">
                  <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-full shadow-md">
                    <ZoomIn className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-bold bg-slate-900/80 px-3 py-1 rounded-full shadow-xs">
                    Klicken zum Vergrößern
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-slate-800 dark:text-white">
                  Mit Smartphone scannen
                </p>
                <p className="text-2xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                  Öffnen Sie Ihre Smartphone-Kamera und richten Sie sie auf den QR-Code, um über Liberapay einen beliebigen Betrag zu spenden.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="w-full pt-3 flex flex-col sm:flex-row gap-2 border-t border-slate-100 dark:border-slate-800">
                <a
                  href={PROJECT_SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Direkt zu Liberapay</span>
                </a>
                <button
                  type="button"
                  onClick={() => setQrModalOpen(true)}
                  className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  title="Vergrößern"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Großansicht</span>
                </button>
                <a
                  href={projectSupportQrUrl ?? undefined}
                  download="liberapay-qr-code.png"
                  className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center cursor-pointer"
                  title="QR-Code herunterladen"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Right: Why support & Thank you (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* General Project Support Highlights */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-800/60">
                    <Coffee className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      Wofür wird Ihre Unterstützung verwendet?
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Jeder Beitrag fließt direkt in den Erhalt und die Weiterentwicklung der Software:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
                      <CheckCheck className="w-4 h-4 shrink-0" />
                      <span>Kontinuierliche Pflege</span>
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Laufende Wartung, technische Fehlerbehebungen und stetige Anpassungen an moderne Browser- und Systemstandards.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      <Shield className="w-4 h-4 shrink-0" />
                      <span>Datensicherheit & Stabilität</span>
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Strikter Schutz sensibler Vereinsdaten, zuverlässige Speicherkonzepte und Einhaltung moderner Sicherheitsstandards.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                      <Server className="w-4 h-4 shrink-0" />
                      <span>Infrastruktur & Bereitstellung</span>
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Zuverlässige Bereitstellung, Vorlagen für Selbsthosting und praxisorientierte Dokumentationen für Administratoren.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                      <Heart className="w-4 h-4 shrink-0" />
                      <span>Freier Zugang fürs Ehrenamt</span>
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Das Projekt dauerhaft unabhängig und ohne kommerzielle Abo-Barrieren für gemeinnützige Vereine zugänglich halten.
                    </p>
                  </div>
                </div>
              </div>

              {/* Thank You Box */}
              <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-7 border border-slate-800 space-y-3 relative overflow-hidden">
                <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                  <Heart className="w-4 h-4 fill-rose-400" />
                  <span>Ein herzliches Dankeschön!</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Ob 5 €, 15 € oder ein regelmäßiger Kaffeebeitrag: Jeder Beitrag stärkt die ehrenamtliche Arbeit und hilft dabei, Vereinsverwaltung für alle einfacher, schneller und verlässlicher zu gestalten.
                </p>
                <div className="pt-2 flex items-center gap-2 text-2xs text-slate-400 font-medium">
                  <span>VereinsManager Entwicklerteam</span>
                  <span>•</span>
                  <span>Mit Engagement für das Vereinswesen</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: BUGREPORTING & PROBLEM MELDEN                                      */}
      {/* ========================================================================= */}
      {activeTab === 'bugreport' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Banner */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="p-3 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20 shrink-0">
                <Bug className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    Problem melden
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Support
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Haben Sie einen Fehler entdeckt oder funktioniert etwas nicht wie erwartet? Senden Sie Ihren Fehlerbericht direkt an das Support-Postfach.
                </p>
              </div>
            </div>
          </div>

          {/* Success Banner / Ticket Confirmation */}
          {submittedTicket && !submittedTicket.delivered && (
            <div className="p-5 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/80 rounded-3xl text-xs text-amber-900 dark:text-amber-200 shadow-xs space-y-2" role="alert">
              <div className="flex items-start justify-between gap-3">
                <div className="font-bold text-sm">
                  Fehlerbericht NICHT versendet <span className="font-mono">#{submittedTicket.ticketId}</span>
                </div>
                <button type="button" onClick={() => setSubmittedTicket(null)} className="p-1 cursor-pointer hover:opacity-80">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="leading-relaxed">{submittedTicket.message}</p>
            </div>
          )}

          {submittedTicket?.delivered && (
            <div className="p-5 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700/80 rounded-3xl text-xs text-emerald-900 dark:text-emerald-200 shadow-xs space-y-3 animate-in fade-in duration-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-xs">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
                      <span>Fehlerbericht an den Mail-Dienst übergeben</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 text-2xs font-mono font-bold">
                        #{submittedTicket.ticketId}
                      </span>
                    </div>
                    <p className="text-2xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                      Übergeben am {submittedTicket.timestamp}. Wenn innerhalb eines Tages keine Antwort kommt, bitte zusätzlich per E-Mail-App senden.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmittedTicket(null)}
                  className="text-emerald-700 dark:text-emerald-400 hover:opacity-80 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetBugForm}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-2xs font-bold transition-colors cursor-pointer"
                >
                  Weiteres Problem melden
                </button>
              </div>
            </div>
          )}

          {/* Regular Success Message if Mail Sent or Copied */}
          {bugSuccessMessage && !submittedTicket && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-medium">{bugSuccessMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setBugSuccessMessage(null)}
                className="text-emerald-700 dark:text-emerald-400 hover:opacity-80 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Main Grid: Left Form (7 cols), Right Guidelines & Diagnostics (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Bug Report Form (7 cols) */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-500" />
                  <span>Fehlerbericht verfassen</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Füllen Sie die nachfolgenden Angaben aus. Der Bericht wird direkt aus der Anwendung heraus an das Support-Postfach übertragen.
                </p>
              </div>

              <form onSubmit={handleDirectSubmitBugReport} className="space-y-5">
                {/* 1. Betreffzeile */}
                <div className="space-y-1.5">
                  <label htmlFor="bug-subject" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    1. Betreffzeile (Kurzbeschreibung des Problems) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="bug-subject"
                    type="text"
                    required
                    value={bugSubject}
                    onChange={(e) => setBugSubject(e.target.value)}
                    placeholder="z. B. SEPA-XML Export bricht bei Umlauten im Nachnamen ab"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                </div>

                {/* 2. Dropdown-Liste der Menüpunkte */}
                <div className="space-y-1.5">
                  <label htmlFor="bug-area" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    2. Betroffener Bereich <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="bug-area"
                    value={bugArea}
                    onChange={(e) => setBugArea(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                  >
                    <optgroup label="Hauptbereiche">
                      <option value="Dashboard (Übersicht)">📊 Dashboard (Übersicht & Schnellstatistiken)</option>
                    </optgroup>
                    <optgroup label="Mitgliederverwaltung">
                      <option value="Mitgliederverwaltung (Mitgliederliste)">👥 Mitgliederverwaltung (Mitgliederliste & Bearbeitung)</option>
                      <option value="Online-Mitgliedsanträge">📝 Online-Mitgliedsanträge (Prüfung & Aufnahme)</option>
                      <option value="Mitglieder-Statistiken">📈 Mitglieder-Statistiken & Auswertungen</option>
                    </optgroup>
                    <optgroup label="Finanzen & Kassenbuch">
                      <option value="Finanzen: Buchungen & Journal">💰 Finanzen: Buchungen & Kassenjournal</option>
                      <option value="Finanzen: Beitragslauf (SEPA)">💳 Finanzen: Beitragslauf & SEPA-XML</option>
                      <option value="Finanzen: EÜR / GuV">📑 Finanzen: EÜR / GuV (Jahresabschluss & BWA)</option>
                      <option value="Finanzen: Spenden">🤝 Finanzen: Spenden & Zuwendungsbestätigungen (BMF)</option>
                      <option value="Finanzen: Finanz-Auswertungen">📊 Finanzen: Finanz-Auswertungen & Diagramme</option>
                    </optgroup>
                    <optgroup label="Vereinsorganisation">
                      <option value="Kalender & Termine">📅 Kalender & Vereinstermine</option>
                      <option value="Inventar & Ausstattung">📦 Inventar & Vereinsausstattung</option>
                      <option value="Dokumente & Archiv">📁 Dokumente & Archiv (Dateiverwaltung)</option>
                    </optgroup>
                    <optgroup label="Systemeinstellungen">
                      <option value="Einstellungen: 1. Allgemeine Einstellungen">⚙️ Einstellungen: 1. Allgemeine Einstellungen & Passwort</option>
                      <option value="Einstellungen: 2. Vereinsstammdaten">🏛️ Einstellungen: 2. Vereinsstammdaten & Logo</option>
                      <option value="Einstellungen: 3. Datensicherung & Import">💾 Einstellungen: 3. Datensicherung & Import</option>
                    </optgroup>
                    <optgroup label="Sicherheit & Allgemein">
                      <option value="Login, Authentifizierung & Sitzung">🔒 Login, Authentifizierung & Sitzung</option>
                      <option value="Design, Dark Mode & Druckansichten">🎨 Design, Dark Mode & Druckansichten</option>
                      <option value="Sonstiges / Allgemeiner Fehler">❓ Sonstiges / Allgemeiner Programmfehler</option>
                    </optgroup>
                  </select>
                </div>

                {/* Schweregrad / Dringlichkeit */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Dringlichkeit / Schweregrad
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setBugSeverity('low')}
                      className={`p-2.5 rounded-xl border text-2xs font-bold text-center transition-all cursor-pointer ${
                        bugSeverity === 'low'
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Niedrig (Kosmetik)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBugSeverity('normal')}
                      className={`p-2.5 rounded-xl border text-2xs font-bold text-center transition-all cursor-pointer ${
                        bugSeverity === 'normal'
                          ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Normal (Fehlerhaft)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBugSeverity('high')}
                      className={`p-2.5 rounded-xl border text-2xs font-bold text-center transition-all cursor-pointer ${
                        bugSeverity === 'high'
                          ? 'bg-orange-50 dark:bg-orange-950/60 border-orange-500 text-orange-700 dark:text-orange-300'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Hoch (Blockiert)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBugSeverity('critical')}
                      className={`p-2.5 rounded-xl border text-2xs font-bold text-center transition-all cursor-pointer ${
                        bugSeverity === 'critical'
                          ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-700 dark:text-rose-300'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Kritisch (Absturz)
                    </button>
                  </div>
                </div>

                {/* 3. Freitextfeld zur genauen Beschreibung des Problems */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="bug-description" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      3. Genaue Beschreibung des Problems <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleInsertTemplate}
                        className="text-2xs text-amber-600 dark:text-amber-400 hover:underline font-bold cursor-pointer"
                      >
                        + Vorlage einfügen
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <button
                        type="button"
                        onClick={() => setBugDescription('')}
                        className="text-2xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                      >
                        Leeren
                      </button>
                    </div>
                  </div>
                  <textarea
                    id="bug-description"
                    required
                    rows={8}
                    value={bugDescription}
                    onChange={(e) => setBugDescription(e.target.value)}
                    placeholder="Bitte beschreiben Sie das Problem so genau wie möglich:&#10;&#10;1. Was haben Sie getan? (Schritte zur Nachstellung)&#10;2. Welcher Fehler oder welches Verhalten ist aufgetreten?&#10;3. Was hätten Sie stattdessen erwartet?&#10;4. Evtl. angezeigter Fehlertext oder Code"
                    className="w-full px-3.5 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono leading-relaxed"
                  />
                </div>

                {/* Optionale Kontaktdaten für Rückfragen */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <UserIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>Kontaktdaten für Rückfragen (optional)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={bugContactName}
                      onChange={(e) => setBugContactName(e.target.value)}
                      placeholder="Ihr Name (z. B. Max Mustermann)"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <input
                      type="email"
                      value={bugContactEmail}
                      onChange={(e) => setBugContactEmail(e.target.value)}
                      placeholder="Ihre E-Mail-Adresse"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Systemdiagnose Checkbox */}
                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bugIncludeSystemInfo}
                    onChange={(e) => setBugIncludeSystemInfo(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 dark:text-amber-400"
                  />
                  <div className="text-2xs text-slate-600 dark:text-slate-400">
                    <span className="font-bold text-slate-800 dark:text-slate-200">System- & Versionsdaten anhängen</span> (App-Version v{CURRENT_APP_VERSION}, Betriebsmodus, Browser & Plattform). Hilft bei der schnellen Analyse.
                  </div>
                </label>

                {/* 4. Buttons zum Versenden des Reports */}
                <div className="pt-2 space-y-3">
                  {/* Primary Submit Button */}
                  <button
                    id="btn-send-bugreport"
                    type="submit"
                    disabled={isSubmittingBug}
                    className="w-full py-3 px-5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmittingBug ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Wird übermittelt...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Problem melden</span>
                      </>
                    )}
                  </button>

                  {/* Clean Horizontal Sub-Action Bar for Alternatives & Reset */}
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-1.5 text-2xs text-slate-400 font-medium shrink-0">
                        <span>Alternative:</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 sm:max-w-md">
                        <button
                          type="button"
                          onClick={handleOpenInMailClient}
                          className="h-8 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-2xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>E-Mail-App</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCopyBugReport}
                          className={`h-8 px-3 rounded-xl text-2xs font-semibold border transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                            bugCopied
                              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {bugCopied ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                          <span>{bugCopied ? 'Kopiert!' : 'Kopieren'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleResetBugForm}
                          className="h-8 px-3 bg-transparent hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl text-2xs font-semibold border border-transparent transition-colors flex items-center justify-center cursor-pointer whitespace-nowrap dark:text-slate-400"
                        >
                          Zurücksetzen
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Right Column: Tips & Live Diagnostics Preview (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Recipient & Direct Contact Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-3.5">
                <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-bold text-sm">
                  <Mail className="w-4 h-4 text-amber-500" />
                  <span>Support-Empfänger</span>
                </div>
                <div className="p-4 bg-amber-50/70 dark:bg-amber-950/40 rounded-2xl border border-amber-200/80 dark:border-amber-800/60">
                  <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                    Alle Fehlerberichte und Feedback-Meldungen gehen direkt an das Support-Postfach und werden zeitnah gesichtet.
                  </p>
                </div>
              </div>

              {/* Tips for a great report */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-3.5">
                <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-bold text-sm">
                  <HelpCircle className="w-4 h-4 text-blue-500" />
                  <span>Tipps für einen schnellen Fix</span>
                </div>
                <ul className="text-2xs text-slate-600 dark:text-slate-400 space-y-2.5 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                    <span><strong>Schritte nennen:</strong> Welche Klicks oder Eingaben führen zum Fehler?</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                    <span><strong>Fehlermeldungen:</strong> Wurde ein genauer Fehlertext oder ein rotes Warnfeld angezeigt?</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                    <span><strong>Erwartetes Ergebnis:</strong> Was hätte die Anwendung stattdessen tun sollen?</span>
                  </li>
                </ul>
              </div>

              {/* Live System Diagnostics Preview */}
              <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <Info className="w-4 h-4 text-amber-400" />
                    <span>System-Diagnose-Vorschau</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                    v{CURRENT_APP_VERSION}
                  </span>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-xl font-mono text-[11px] text-slate-300 space-y-1 border border-slate-800/80">
                  <div><span className="text-slate-500 dark:text-slate-400">App-Version:</span> v{CURRENT_APP_VERSION}</div>
                  <div><span className="text-slate-500 dark:text-slate-400">Plattform:</span> {typeof navigator !== 'undefined' ? (navigator.userAgent.includes('Windows') ? 'Windows' : navigator.userAgent.includes('Mac') ? 'macOS' : navigator.userAgent.includes('Linux') ? 'Linux' : 'Web/Mobil') : 'Web'}</div>
                  <div><span className="text-slate-500 dark:text-slate-400">Auflösung:</span> {typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'n/a'}</div>
                  <div><span className="text-slate-500 dark:text-slate-400">Sprache:</span> {typeof navigator !== 'undefined' ? navigator.language : 'de-DE'}</div>
                </div>

                <p className="text-2xs text-slate-400 leading-relaxed">
                  Diese Parameter werden dem Fehlerbericht automatisch beigefügt, um die Fehlerursache ohne langes Nachfragen direkt eingrenzen zu können.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL FOR QR CODE */}
      {qrModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setQrModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center space-y-5 relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setQrModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              title="Schließen"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <QrCode className="w-3.5 h-3.5" />
                <span>Liberapay Spenden-QR-Code</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Direkt mit dem Smartphone scannen
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                Richten Sie die Smartphone-Kamera auf das Bild, um zu Liberapay zu gelangen.
              </p>
            </div>

            {/* High-Resolution Large QR Display */}
            <div className="w-72 h-72 sm:w-80 sm:h-80 bg-white p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-inner flex items-center justify-center dark:bg-slate-900">
              <img
                src={projectSupportQrUrl ?? undefined}
                alt="Liberapay QR Code vergrößert"
                className="w-full h-full object-contain rounded-xl select-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href={PROJECT_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Auf Liberapay öffnen</span>
              </a>
              <a
                href={projectSupportQrUrl ?? undefined}
                download="liberapay-qr-code.png"
                className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Herunterladen</span>
              </a>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* External Link Confirmation Modal (Requirement 5) */}
      {externalLinkModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
                <ExternalLink className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Applikation jetzt verlassen?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Hinweis: Sie verlassen nun die Vereinsverwaltung. Die Website von <strong className="text-slate-800 dark:text-slate-200">{externalLinkModal.providerName}</strong> wird in Ihrem installierten Browser geöffnet, damit Sie sich dort anmelden und einen API-Schlüssel erstellen können.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-1.5">
              <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">
                Ziel-Adresse
              </span>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs text-purple-600 dark:text-purple-400 font-mono break-all select-all">
                  {externalLinkModal.url}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopyLink(externalLinkModal.url)}
                  className="px-2.5 py-1 text-2xs font-semibold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                >
                  {linkCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Kopiert!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Kopieren</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setExternalLinkModal(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleOpenExternalUrlConfirmed}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Website im Browser öffnen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bestätigung vor dem Einspielen einer Datensicherung. Solange dieser
          Dialog offen ist, wurde am Datenbestand noch nichts verändert. */}
      <BackupImportDialog
        isOpen={Boolean(importVorschau)}
        dateiName={importVorschau?.dateiName || ''}
        kopf={importVorschau?.kopf || {}}
        vergleich={importVorschau?.vergleich || []}
        laeuft={importLaeuft}
        fehler={importFehler}
        onAbbrechen={() => {
          setImportVorschau(null);
          setImportFehler(null);
        }}
        onBestaetigen={fuehreImportAus}
      />

      {/* Bedingt eingebunden, damit eingetippte Passwörter beim Schließen
          nicht im Zustand der Seite zurückbleiben. */}
      {exportDialogOffen && (
        <BackupExportDialog
          isOpen
          laeuft={exportLaeuft}
          onAbbrechen={() => setExportDialogOffen(false)}
          onBestaetigen={fuehreExportAus}
        />
      )}
      {passwortAbfrage && (
        <BackupPasswordDialog
          isOpen
          dateiName={passwortAbfrage.dateiName}
          onEntschluesseln={entschluesseleSicherung}
          onAbbrechen={() => setPasswortAbfrage(null)}
        />
      )}
    </div>
  );
};
