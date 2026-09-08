import React, { useState, useEffect, useRef } from 'react';
import { ClubSettings, AppUser, UserPermissions, DeploymentMode, Address, AiProviderType, BoardMember } from '../types';
import { StorageService } from '../services/storage';
import { AuthService } from '../services/authService';
import { AiBookingService } from '../services/aiBookingService';
import { SnapshotService, AutoSnapshot } from '../services/snapshotService';
import { CURRENT_APP_VERSION } from '../services/updateService';
import { FULL_PERMISSIONS } from '../data/roles';
import { DeploymentHubSettingsPanel } from './DeploymentHubSettingsPanel';
import { openExternalUrl } from '../utils/externalLink';
import { saveBlobWithLocationPicker } from '../utils/fileExportHelper';
import paypalQrImage from '../assets/paypal-original.jpg';
import {
  Settings,
  Building,
  Database,
  Globe,
  Users,
  Shield,
  ShieldCheck,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Lock,
  CreditCard,
  Sun,
  Moon,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  UserPlus,
  Edit3,
  User as UserIcon,
  Eye,
  EyeOff,
  Check,
  UserCheck,
  UserX,
  Sparkles,
  Server,
  HardDrive,
  Cloud,
  CheckCheck,
  Mail,
  Phone,
  Calendar,
  Layers,
  Heart,
  ExternalLink,
  Copy,
  Coffee,
  QrCode,
  ZoomIn,
  X,
  Maximize2,
  Image as ImageIcon,
  Key,
  Bot,
  Bug,
  Send,
  MessageSquare,
  HelpCircle,
  Info,
  History,
  RotateCcw,
  Search,
  Clock,
  Archive,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Plus
} from 'lucide-react';

interface ProviderMeta {
  id: AiProviderType;
  name: string;
  badge: string;
  badgeColor: string;
  keyLabel: string;
  keyPlaceholder: string;
  keyLinkUrl: string;
  keyLinkLabel: string;
  defaultModel?: string;
  models?: { id: string; name: string }[];
  needsBaseUrl?: boolean;
  defaultBaseUrl?: string;
  description: string;
}

const AI_PROVIDERS: ProviderMeta[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Empfohlen • Kostenlos',
    badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300',
    keyLabel: 'Google Gemini API-Schlüssel',
    keyPlaceholder: 'AIzaSy...',
    keyLinkUrl: 'https://aistudio.google.com/app/apikey',
    keyLinkLabel: 'Kostenlosen Schlüssel generieren',
    description: 'Dauerhaft kostenloser Tarif mit bis zu 15 Anfragen/Min. in Google AI Studio.',
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    badge: 'GPT-4o & mini',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    keyLabel: 'OpenAI API-Schlüssel',
    keyPlaceholder: 'sk-proj-...',
    keyLinkUrl: 'https://platform.openai.com/api-keys',
    keyLinkLabel: 'Schlüssel auf platform.openai.com erstellen',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o mini (Sehr schnell & kostengünstig)' },
      { id: 'gpt-4o', name: 'GPT-4o (Höchste Genauigkeit)' },
    ],
    description: 'Verbindung über Ihr OpenAI-Entwicklerkonto mit modernsten Modellen.',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    badge: 'Claude 3.5',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    keyLabel: 'Anthropic Claude API-Schlüssel',
    keyPlaceholder: 'sk-ant-...',
    keyLinkUrl: 'https://console.anthropic.com/settings/keys',
    keyLinkLabel: 'Schlüssel in Anthropic Console erstellen',
    defaultModel: 'claude-3-5-haiku-20241022',
    models: [
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Ultraschnell)' },
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet (Rechtssichere Texte)' },
    ],
    description: 'Hervorragend geeignet für redaktionelle Protokolle und Beschlusstexte.',
  },
  {
    id: 'custom',
    name: 'Benutzerdefiniert / Lokal',
    badge: 'Ollama & Groq',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
    keyLabel: 'API-Schlüssel / Token (optional)',
    keyPlaceholder: 'Optional (Bearer Token oder leer bei lokalem Ollama)',
    keyLinkUrl: 'https://ollama.com',
    keyLinkLabel: 'Ollama Dokumentation & Download',
    needsBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    description: 'Kompatibel mit lokalen Modellen (Ollama, LM Studio) oder Gateways (Groq, OpenRouter).',
  },
];

interface SettingsViewProps {
  settings: ClubSettings;
  onSaveSettings: (settings: ClubSettings) => void;
  onDataReload?: () => void;
  onOpenDeploymentHub?: () => void;
  onOpenUserManage?: () => void;
  currentTheme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  deploymentMode?: DeploymentMode;
  onDeploymentModeChange?: (mode: DeploymentMode) => void;
  initialTab?: SettingsTab;
  onTabChange?: (tab: SettingsTab) => void;
}

interface PermissionItem {
  key: keyof UserPermissions;
  label: string;
  category: 'Mitglieder' | 'Finanzen & SEPA' | 'Dokumente & Inventar' | 'System & Verwaltung';
  description: string;
}

const PERMISSION_ITEMS: PermissionItem[] = [
  // Mitglieder
  {
    key: 'canViewMembers',
    label: 'Mitglieder einsehen',
    category: 'Mitglieder',
    description: 'Zugriff auf Mitgliederliste, Kontaktdaten und Jubiläen'
  },
  {
    key: 'canEditMembers',
    label: 'Mitglieder anlegen & bearbeiten',
    category: 'Mitglieder',
    description: 'Neueintritte erfassen, Daten ändern und Kündigungen verarbeiten'
  },

  // Finanzen
  {
    key: 'canViewFinances',
    label: 'Finanzen & Kassenbuch einsehen',
    category: 'Finanzen & SEPA',
    description: 'Einsicht in Buchungsjournal, Kontenstände und EÜR/GuV'
  },
  {
    key: 'canEditFinances',
    label: 'Buchungen erfassen & ändern',
    category: 'Finanzen & SEPA',
    description: 'Neue Einnahmen/Ausgaben anlegen, Belege zuordnen und stornieren'
  },
  {
    key: 'canExecuteSepa',
    label: 'SEPA-Beitragslauf ausführen',
    category: 'Finanzen & SEPA',
    description: 'SEPA-Lastschrift-XML generieren und Buchungen erzeugen'
  },
  {
    key: 'canManageDonations',
    label: 'Spendenbescheinigungen ausstellen',
    category: 'Finanzen & SEPA',
    description: 'Geld- und Sachzuwendungsbestätigungen nach BMF-Muster erstellen'
  },

  // Dokumente & Inventar
  {
    key: 'canManageDocuments',
    label: 'Dokumentenarchiv & Belege verwalten',
    category: 'Dokumente & Inventar',
    description: 'Dateien hochladen, Ordner erstellen und Belege archivieren'
  },
  {
    key: 'canManageInventory',
    label: 'Inventar & Material verwalten',
    category: 'Dokumente & Inventar',
    description: 'Vereinsausstattung, Geräte und Wartungsintervalle pflegen'
  },

  // System
  {
    key: 'canManageSettings',
    label: 'Vereinseinstellungen ändern',
    category: 'System & Verwaltung',
    description: 'Stammdaten, Bankkonten, Beitragsstaffeln und Systemoptionen verwalten'
  },
  {
    key: 'canManageUsers',
    label: 'Benutzerkonten & Rechte verwalten',
    category: 'System & Verwaltung',
    description: 'Benutzer anlegen, Passwörter vergeben und Berechtigungen festlegen'
  }
];

const DEFAULT_BLANK_PERMISSIONS: UserPermissions = {
  canViewMembers: true,
  canEditMembers: false,
  canViewFinances: false,
  canEditFinances: false,
  canExecuteSepa: false,
  canManageDonations: false,
  canManageDocuments: false,
  canManageInventory: false,
  canManageSettings: false,
  canManageUsers: false
};

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

type SettingsTab = 'general' | 'club' | 'users' | 'backup' | 'deployment' | 'support' | 'bugreport';

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onDataReload,
  onOpenDeploymentHub,
  currentTheme,
  onThemeChange,
  deploymentMode,
  onDeploymentModeChange,
  initialTab,
  onTabChange
}) => {
  const [currentDepMode, setCurrentDepMode] = useState<DeploymentMode>(
    deploymentMode || StorageService.getDeploymentMode()
  );

  useEffect(() => {
    if (deploymentMode) {
      setCurrentDepMode(deploymentMode);
    }
  }, [deploymentMode]);

  const handleModeChange = (mode: DeploymentMode) => {
    setCurrentDepMode(mode);
    onDeploymentModeChange?.(mode);
  };
  // Tab sequence:
  // 1. Allgemeine Einstellungen
  // 2. Vereinsstammdaten
  // 3. Benutzer & Rechte
  // 4. Datensicherung und Import
  // 5. Betriebsmodi
  // 6. Projekt unterstützen
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
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [usersList, setUsersList] = useState<AppUser[]>(() => AuthService.getUsers());
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // User In-Place Editing State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userFormUsername, setUserFormUsername] = useState('');
  const [userFormName, setUserFormName] = useState('');
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormRole, setUserFormRole] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormPermissions, setUserFormPermissions] = useState<UserPermissions>({ ...DEFAULT_BLANK_PERMISSIONS });
  const [userFormIsActive, setUserFormIsActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [userMsg, setUserMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // AI Assistant State (Supporting Gemini, OpenAI, Anthropic, Custom/Ollama)
  const initialAiConfig = AiBookingService.getAiConfig();
  const [aiProvider, setAiProvider] = useState<AiProviderType>(
    () => settings.aiProvider || initialAiConfig.provider || 'gemini'
  );
  const [aiApiKey, setAiApiKey] = useState<string>(
    () => settings.aiApiKey || settings.geminiApiKey || initialAiConfig.apiKey || ''
  );
  const [aiModel, setAiModel] = useState<string>(
    () => settings.aiModel || initialAiConfig.model || ''
  );
  const [aiBaseUrl, setAiBaseUrl] = useState<string>(
    () => settings.aiBaseUrl || initialAiConfig.baseUrl || ''
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // SMTP Configuration State (Sitzungsdienst & Vereinskorrespondenz)
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [smtpTestEmailInput, setSmtpTestEmailInput] = useState('');
  const [showSmtpTestInput, setShowSmtpTestInput] = useState(false);

  const applySmtpPreset = (preset: 'ionos' | 'strato' | 'gmail' | 'gmx' | 'webde' | 'telekom') => {
    switch (preset) {
      case 'ionos':
        setFormData(prev => ({
          ...prev,
          smtpHost: 'smtp.ionos.de',
          smtpPort: 587,
          smtpSecure: false,
          smtpFromName: prev.smtpFromName || prev.clubName || 'TSV Musterstadt 1890 e.V.'
        }));
        break;
      case 'strato':
        setFormData(prev => ({
          ...prev,
          smtpHost: 'smtp.strato.de',
          smtpPort: 465,
          smtpSecure: true,
          smtpFromName: prev.smtpFromName || prev.clubName || 'TSV Musterstadt 1890 e.V.'
        }));
        break;
      case 'gmail':
        setFormData(prev => ({
          ...prev,
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpSecure: false,
          smtpFromName: prev.smtpFromName || prev.clubName || 'TSV Musterstadt 1890 e.V.'
        }));
        break;
      case 'gmx':
        setFormData(prev => ({
          ...prev,
          smtpHost: 'mail.gmx.net',
          smtpPort: 587,
          smtpSecure: false,
          smtpFromName: prev.smtpFromName || prev.clubName || 'TSV Musterstadt 1890 e.V.'
        }));
        break;
      case 'webde':
        setFormData(prev => ({
          ...prev,
          smtpHost: 'smtp.web.de',
          smtpPort: 587,
          smtpSecure: false,
          smtpFromName: prev.smtpFromName || prev.clubName || 'TSV Musterstadt 1890 e.V.'
        }));
        break;
      case 'telekom':
        setFormData(prev => ({
          ...prev,
          smtpHost: 'securesmtp.t-online.de',
          smtpPort: 587,
          smtpSecure: false,
          smtpFromName: prev.smtpFromName || prev.clubName || 'TSV Musterstadt 1890 e.V.'
        }));
        break;
    }
  };

  const handleTestSmtp = async () => {
    if (!formData.smtpHost?.trim()) {
      setSmtpTestResult({
        success: false,
        message: 'Bitte geben Sie zuerst einen SMTP-Hostnamen an (z.B. smtp.ionos.de).'
      });
      return;
    }

    setIsTestingSmtp(true);
    setSmtpTestResult(null);

    try {
      const res = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: formData.smtpHost.trim(),
          port: formData.smtpPort || (formData.smtpSecure ? 465 : 587),
          secure: Boolean(formData.smtpSecure),
          user: formData.smtpUser?.trim(),
          password: formData.smtpPassword,
          fromEmail: formData.smtpFromEmail?.trim() || formData.email,
          testRecipient: smtpTestEmailInput.trim() || undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSmtpTestResult({
          success: true,
          message: data.message || 'SMTP-Verbindung erfolgreich aufgebaut und authentifiziert.'
        });
      } else {
        setSmtpTestResult({
          success: false,
          message: data.error || 'SMTP-Verbindung fehlgeschlagen. Bitte Zugangsdaten und Port überprüfen.'
        });
      }
    } catch (err: any) {
      setSmtpTestResult({
        success: false,
        message: err.message || 'Netzwerkfehler beim Verbindungstest zum Server.'
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

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
  const [submittedTicket, setSubmittedTicket] = useState<{ ticketId: string; timestamp: string; message: string } | null>(null);

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
      report += `- Betriebsmodus: ${currentDepMode === 'cloud' ? 'Cloud-Hosting (Supabase EU)' : currentDepMode === 'selfhosted' ? 'Selbsthoster (Docker Server)' : 'Lokaler Einzelplatz (IndexedDB)'}\n`;
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

    try {
      const clientInfo = bugIncludeSystemInfo
        ? `App v${CURRENT_APP_VERSION} | Modus: ${currentDepMode} | UA: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a'} | Screen: ${typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'n/a'}`
        : 'Keine Diagnosedaten';

      const response = await fetch('/api/submit-bugreport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: bugSubject.trim(),
          area: bugArea,
          description: bugDescription.trim(),
          severity: bugSeverity,
          contactName: bugContactName.trim() || undefined,
          contactEmail: bugContactEmail.trim() || undefined,
          appVersion: `v${CURRENT_APP_VERSION}`,
          deploymentMode: currentDepMode,
          clientDetails: clientInfo,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSubmittedTicket({
          ticketId: result.ticketId || `VM-${Date.now().toString(36).toUpperCase()}`,
          timestamp: result.timestamp || new Date().toLocaleString('de-DE'),
          message: result.message || 'Ihr Fehlerbericht wurde direkt an vereinsmanager@ik.me übermittelt.',
        });
        setBugSuccessMessage(`Fehlerbericht erfolgreich direkt versendet! Ticket-Nr: #${result.ticketId || 'VM'}`);
        setStatusMsg({
          type: 'success',
          text: `Fehlerbericht wurde direkt an vereinsmanager@ik.me übermittelt (Ticket #${result.ticketId})`,
        });
      } else {
        throw new Error(result.error || 'Server konnte den Bericht nicht annehmen.');
      }
    } catch (err: any) {
      console.error('Fehler bei direkter In-App Übermittlung:', err);
      // Fallback: Explain and allow mailto or clipboard
      setStatusMsg({
        type: 'error',
        text: `Direkter Versand fehlgeschlagen (${err?.message || 'Netzwerkfehler'}). Sie können den Bericht alternativ über das E-Mail-Programm senden.`
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

  const startEditUser = (user: AppUser) => {
    setEditingUserId(user.id);
    setIsCreatingUser(false);
    setUserFormUsername(user.username);
    setUserFormName(user.name);
    setUserFormEmail(user.email || '');
    setUserFormRole(user.customRoleName || '');
    setUserFormPassword('');
    setUserFormPermissions({ ...user.permissions });
    setUserFormIsActive(user.isActive !== false);
    setShowPassword(false);
    setUserMsg(null);
  };

  const startCreateUser = () => {
    setEditingUserId(null);
    setIsCreatingUser(true);
    setUserFormUsername('');
    setUserFormName('');
    setUserFormEmail('');
    setUserFormRole('');
    setUserFormPassword('');
    setUserFormPermissions({ ...DEFAULT_BLANK_PERMISSIONS });
    setUserFormIsActive(true);
    setShowPassword(false);
    setUserMsg(null);
  };

  const cancelEditUser = () => {
    setEditingUserId(null);
    setIsCreatingUser(false);
    setUserMsg(null);
  };

  const toggleUserPermission = (key: keyof UserPermissions) => {
    setUserFormPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const applyPreset = (preset: 'all' | 'finance' | 'read_only' | 'members' | 'none') => {
    switch (preset) {
      case 'all':
        setUserFormPermissions({ ...FULL_PERMISSIONS });
        break;
      case 'finance':
        setUserFormPermissions({
          canViewMembers: true,
          canEditMembers: false,
          canViewFinances: true,
          canEditFinances: true,
          canExecuteSepa: true,
          canManageDonations: true,
          canManageDocuments: true,
          canManageInventory: true,
          canManageSettings: false,
          canManageUsers: false
        });
        break;
      case 'read_only':
        setUserFormPermissions({
          canViewMembers: true,
          canEditMembers: false,
          canViewFinances: true,
          canEditFinances: false,
          canExecuteSepa: false,
          canManageDonations: false,
          canManageDocuments: true,
          canManageInventory: true,
          canManageSettings: false,
          canManageUsers: false
        });
        break;
      case 'members':
        setUserFormPermissions({
          canViewMembers: true,
          canEditMembers: true,
          canViewFinances: false,
          canEditFinances: false,
          canExecuteSepa: false,
          canManageDonations: false,
          canManageDocuments: true,
          canManageInventory: false,
          canManageSettings: false,
          canManageUsers: false
        });
        break;
      case 'none':
        setUserFormPermissions({ ...DEFAULT_BLANK_PERMISSIONS });
        break;
    }
  };

  const handleSaveUserForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormUsername.trim() || !userFormName.trim()) {
      setUserMsg({ type: 'error', text: 'Benutzername und vollständiger Name sind Pflichtfelder.' });
      return;
    }

    if (isCreatingUser) {
      if (!userFormPassword.trim()) {
        setUserMsg({ type: 'error', text: 'Bitte vergeben Sie ein initiales Passwort für das neue Konto.' });
        return;
      }
      try {
        const newUser: AppUser = {
          id: `user-${Date.now()}`,
          username: userFormUsername.trim().toLowerCase(),
          name: userFormName.trim(),
          email: userFormEmail.trim(),
          password: userFormPassword.trim(),
          customRoleName: userFormRole.trim() || 'Benutzer',
          permissions: userFormPermissions,
          isActive: userFormIsActive,
          createdAt: new Date().toISOString()
        };
        AuthService.saveUser(newUser);
        setUsersList(AuthService.getUsers());
        setIsCreatingUser(false);
        setUserMsg({ type: 'success', text: `Benutzer "${userFormName}" erfolgreich angelegt.` });
        setTimeout(() => setUserMsg(null), 3500);
        onDataReload?.();
      } catch (err: any) {
        setUserMsg({ type: 'error', text: err.message || 'Fehler beim Anlegen des Benutzers.' });
      }
    } else if (editingUserId) {
      try {
        const existing = usersList.find(u => u.id === editingUserId);
        const updatedUser: AppUser = {
          id: editingUserId,
          username: userFormUsername.trim().toLowerCase(),
          name: userFormName.trim(),
          email: userFormEmail.trim(),
          password: userFormPassword.trim() || (existing?.password || ''),
          customRoleName: userFormRole.trim() || 'Benutzer',
          permissions: userFormPermissions,
          isActive: userFormIsActive,
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        AuthService.saveUser(updatedUser);
        setUsersList(AuthService.getUsers());
        setEditingUserId(null);
        setUserMsg({ type: 'success', text: `Benutzer "${userFormName}" erfolgreich aktualisiert.` });
        setTimeout(() => setUserMsg(null), 3500);
        onDataReload?.();
      } catch (err: any) {
        setUserMsg({ type: 'error', text: err.message || 'Fehler beim Aktualisieren des Benutzers.' });
      }
    }
  };

  const handleDeleteUser = (user: AppUser) => {
    if (usersList.length <= 1) {
      alert('Der letzte verbleibende Administrator kann nicht gelöscht werden.');
      return;
    }
    if (window.confirm(`Benutzerkonto "${user.name}" (${user.username}) wirklich unwiderruflich löschen?`)) {
      AuthService.deleteUser(user.id);
      setUsersList(AuthService.getUsers());
      if (editingUserId === user.id) {
        setEditingUserId(null);
      }
      setUserMsg({ type: 'success', text: `Benutzer "${user.name}" wurde gelöscht.` });
      setTimeout(() => setUserMsg(null), 3000);
      onDataReload?.();
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
      aiProvider,
      aiApiKey: aiApiKey.trim() || undefined,
      aiModel: aiModel.trim() || undefined,
      aiBaseUrl: aiBaseUrl.trim() || undefined,
      geminiApiKey: aiProvider === 'gemini' ? aiApiKey.trim() || undefined : formData.geminiApiKey,
    };
    setFormData(updated);
    AiBookingService.setAiConfig({
      provider: aiProvider,
      apiKey: aiApiKey.trim(),
      model: aiModel.trim() || undefined,
      baseUrl: aiBaseUrl.trim() || undefined,
    });

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

  const handleMoveBoardMember = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= boardMembers.length) return;
    setBoardMembers(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  // Department Drag and Drop Handlers
  const handleDeptDragStart = (e: React.DragEvent, index: number) => {
    setDraggedDeptIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
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

  const handleMoveDepartment = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= formData.departments.length) return;
    setFormData(prev => {
      const next = [...prev.departments];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return { ...prev, departments: next };
    });
  };

  const handleTestAiKey = async () => {
    setIsTestingKey(true);
    setKeyTestResult(null);
    try {
      const res = await AiBookingService.testConnection(
        aiApiKey.trim(),
        aiProvider,
        aiModel.trim() || undefined,
        aiBaseUrl.trim() || undefined
      );
      setKeyTestResult(res);
      if (res.success) {
        AiBookingService.setAiConfig({
          provider: aiProvider,
          apiKey: aiApiKey.trim(),
          model: aiModel.trim() || undefined,
          baseUrl: aiBaseUrl.trim() || undefined,
        });
      }
    } catch (err: any) {
      setKeyTestResult({ success: false, message: err?.message || 'Verbindungstest fehlgeschlagen.' });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleSaveAiConfigOnly = () => {
    const trimmedKey = aiApiKey.trim();
    AiBookingService.setAiConfig({
      provider: aiProvider,
      apiKey: trimmedKey,
      model: aiModel.trim() || undefined,
      baseUrl: aiBaseUrl.trim() || undefined,
    });
    const selectedProvider = AI_PROVIDERS.find(p => p.id === aiProvider) || AI_PROVIDERS[0];
    const updated: ClubSettings = {
      ...formData,
      aiProvider,
      aiApiKey: trimmedKey || undefined,
      aiModel: aiModel.trim() || undefined,
      aiBaseUrl: aiBaseUrl.trim() || undefined,
      geminiApiKey: aiProvider === 'gemini' ? trimmedKey || undefined : formData.geminiApiKey,
    };
    setFormData(updated);
    onSaveSettings(updated);
    setStatusMsg({
      type: 'success',
      text: `KI-Konfiguration (${selectedProvider.name}) wurde erfolgreich gespeichert.`
    });
    setTimeout(() => setStatusMsg(null), 3000);
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

  // Full Backup Export with destination folder selection
  const handleExportBackup = async () => {
    try {
      const json = await StorageService.exportFullBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const dateStr = new Date().toISOString().split('T')[0];
      const safeClub = (formData.clubName || 'Verein').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_');
      const filename = `VereinsManager_Sicherung_${safeClub}_${dateStr}.json`;

      const result = await saveBlobWithLocationPicker(blob, filename, {
        description: 'JSON-Datensicherungsdatei (*.json)',
        mimeType: 'application/json',
        extension: '.json'
      });

      if (result.cancelled) {
        setStatusMsg({ type: 'info', text: 'Sicherung abgebrochen (kein Speicherort gewählt).' });
        setTimeout(() => setStatusMsg(null), 3000);
      } else if (result.success) {
        setStatusMsg({
          type: 'success',
          text: result.method === 'picker'
            ? `Datensicherung erfolgreich gespeichert als: "${result.fileName}"`
            : `Datensicherung "${result.fileName}" erfolgreich gespeichert.`
        });
        setTimeout(() => setStatusMsg(null), 4500);
      } else {
        setStatusMsg({ type: 'error', text: result.error || 'Fehler beim Speichern der Sicherung.' });
        setTimeout(() => setStatusMsg(null), 4000);
      }
    } catch (err: any) {
      console.error('Fehler beim Export der Sicherung:', err);
      setStatusMsg({ type: 'error', text: 'Fehler beim Erstellen der Sicherung.' });
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  // Full Backup Import
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Achtung: Durch das Einspielen der Sicherung werden die aktuellen lokalen Daten überschrieben. Fortfahren?')) {
      return;
    }

    try {
      const text = await file.text();
      const result = await StorageService.importFullBackup(text);
      onDataReload?.();
      setStatusMsg({
        type: 'success',
        text: `Sicherung erfolgreich wiederhergestellt (${result.membersCount} Mitglieder, ${result.transactionsCount} Buchungen).`
      });
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Fehler beim Import: ${err.message || 'Ungültige Datei'}` });
    }
  };

  // Reset to Demo
  const handleResetToDemo = async () => {
    if (window.confirm('Möchten Sie die Datenbank wirklich auf die Muster-Vereinsdaten zurücksetzen?')) {
      await StorageService.resetToDemoData();
      onDataReload?.();
      setStatusMsg({ type: 'success', text: 'Muster-Vereinsdaten wurden erfolgreich geladen.' });
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  // Wipe All
  const handleWipeAll = async () => {
    if (window.confirm('ACHTUNG: Möchten Sie wirklich ALLE Mitglieder, Buchungen und Konten löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) {
      await StorageService.clearAllData();
      onDataReload?.();
      setStatusMsg({ type: 'success', text: 'Alle lokalen Daten wurden gelöscht.' });
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  // Auto-Snapshots & Legacy Recovery State & Handlers
  const [snapshots, setSnapshots] = useState<AutoSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [isScanningLegacy, setIsScanningLegacy] = useState(false);
  const [legacyScanFeedback, setLegacyScanFeedback] = useState<string | null>(null);

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

  useEffect(() => {
    if (activeTab === 'backup') {
      loadSnapshotsList();
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
      setStatusMsg({ type: 'error', text: 'Fehler bei der Wiederherstellung.' });
    }
  };

  const handleDeleteSnapshot = async (snapId: string) => {
    if (!window.confirm('Möchten Sie diesen Snapshot wirklich löschen?')) return;
    await SnapshotService.deleteSnapshot(snapId);
    loadSnapshotsList();
  };

  const handleRunLegacyScan = async () => {
    setIsScanningLegacy(true);
    setLegacyScanFeedback(null);
    try {
      const res = await SnapshotService.scanAndRecoverLegacyData();
      if (res.recovered) {
        onDataReload?.();
        setLegacyScanFeedback(`✅ ${res.details}`);
        setStatusMsg({ type: 'success', text: `Altdaten aus "${res.source}" gerettet!` });
        loadSnapshotsList();
      } else {
        setLegacyScanFeedback('ℹ️ Es wurden keine Altdaten in anderen Browser-Speichern oder früheren Datenbanken gefunden.');
      }
    } catch (e: any) {
      setLegacyScanFeedback(`Fehler beim Scan: ${e.message || 'Unbekannter Fehler'}`);
    } finally {
      setIsScanningLegacy(false);
    }
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
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
                Konfigurieren Sie Erscheinungsbild, Vereinsstammdaten, Zugriffsrechte, Backups und Betriebsmodi.
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

          {/* 3. Benutzer & Rechte */}
          <button
            type="button"
            onClick={() => {
              setUsersList(AuthService.getUsers());
              switchTab('users');
            }}
            className={`pb-3.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>3. Benutzer & Rechte</span>
          </button>

          {/* 4. Datensicherung und Import */}
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
            <span>4. Datensicherung und Import</span>
          </button>

          {/* 5. Betriebsmodi */}
          <button
            type="button"
            onClick={() => switchTab('deployment')}
            className={`pb-3.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'deployment'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>5. Betriebsmodi</span>
          </button>

          {/* 6. Projekt unterstützen */}
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
            <span>6. Projekt unterstützen</span>
          </button>

          {/* 7. Problem melden (Bugreporting) */}
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
            <span>7. Problem melden</span>
          </button>
        </div>
      </div>

      {/* Status & Feedback Toast Message */}
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 animate-in fade-in duration-200 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
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
                    <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
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

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Allgemeine Einstellungen speichern
              </button>
            </div>
          </form>

          {/* KI-Assistent Card */}
          {(() => {
            const currentProviderInfo = AI_PROVIDERS.find(p => p.id === aiProvider) || AI_PROVIDERS[0];
            const isConfigured = Boolean(aiApiKey.trim() || (aiProvider === 'custom' && aiBaseUrl.trim()));

            return (
              <div className="bg-white dark:bg-slate-900 border border-purple-200/80 dark:border-purple-900/40 rounded-3xl p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-2xl shadow-xs">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          KI-Assistent
                        </h3>
                        <span className={`px-2 py-0.5 text-3xs font-bold rounded-full ${
                          isConfigured
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {isConfigured ? `Aktiviert (${currentProviderInfo.name})` : 'Optional'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Unterstützt Sie bei der Buchungskontierung, Belegprüfung, Protokoll- und Notizenerfassung sowie bei der Auswertung von Mitgliedsanträgen.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Provider Selection */}
                  <div>
                    <label className="block text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      KI-Anbieter auswählen
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {AI_PROVIDERS.map(provider => {
                        const isSelected = aiProvider === provider.id;
                        return (
                          <button
                            key={provider.id}
                            type="button"
                            onClick={() => {
                              setAiProvider(provider.id);
                              setKeyTestResult(null);
                              if (provider.defaultModel && (!aiModel || !provider.models?.some(m => m.id === aiModel))) {
                                setAiModel(provider.defaultModel);
                              }
                              if (provider.defaultBaseUrl && !aiBaseUrl) {
                                setAiBaseUrl(provider.defaultBaseUrl);
                              }
                            }}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                              isSelected
                                ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-500 dark:border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                                : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {provider.name}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />}
                            </div>
                            <span className={`px-1.5 py-0.5 text-3xs font-semibold rounded-md w-fit ${provider.badgeColor}`}>
                              {provider.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 mt-2">
                      {currentProviderInfo.description}
                    </p>
                  </div>

                  {/* Optional Custom Base URL */}
                  {currentProviderInfo.needsBaseUrl && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        API-Basis-URL (OpenAI-kompatibel)
                      </label>
                      <input
                        type="text"
                        value={aiBaseUrl}
                        onChange={e => setAiBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434/v1"
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:bg-white"
                      />
                      <p className="text-3xs text-slate-400 dark:text-slate-500 mt-1">
                        Beispiel Ollama: http://localhost:11434/v1 • LM Studio: http://localhost:1234/v1 • Groq: https://api.groq.com/openai/v1
                      </p>
                    </div>
                  )}

                  {/* Model Selection if options exist */}
                  {currentProviderInfo.models && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Bevorzugtes Modell
                      </label>
                      <select
                        value={aiModel || currentProviderInfo.defaultModel || ''}
                        onChange={e => setAiModel(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:bg-white"
                      >
                        {currentProviderInfo.models.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* API Key Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between flex-wrap gap-1">
                      <span className="flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        {currentProviderInfo.keyLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExternalLinkModal({
                          isOpen: true,
                          url: currentProviderInfo.keyLinkUrl,
                          title: currentProviderInfo.keyLinkLabel,
                          providerName: currentProviderInfo.name,
                        })}
                        className="text-2xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <span>{currentProviderInfo.keyLinkLabel}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={aiApiKey}
                          onChange={e => setAiApiKey(e.target.value)}
                          placeholder={currentProviderInfo.keyPlaceholder}
                          className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title={showApiKey ? 'Schlüssel verbergen' : 'Schlüssel anzeigen'}
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleTestAiKey}
                          disabled={isTestingKey || (!aiApiKey.trim() && aiProvider !== 'custom')}
                          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isTestingKey ? 'animate-spin' : ''}`} />
                          <span>{isTestingKey ? 'Prüfe...' : 'Verbindung testen'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveAiConfigOnly}
                          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Speichern</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Test Result Message */}
                  {keyTestResult && (
                    <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                      keyTestResult.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    }`}>
                      {keyTestResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      )}
                      <span>{keyTestResult.message}</span>
                    </div>
                  )}

                  {/* Information callout: Funktionsweise & Datenschutz */}
                  <div className="bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 rounded-2xl p-4 text-2xs text-slate-600 dark:text-slate-400 space-y-2">
                    <div className="font-bold text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>Funktionsweise & Datenschutz</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                      <li>
                        <strong>Lokale Speicherung:</strong> Ihr API-Schlüssel wird ausschließlich lokal in Ihrer VereinsManager-Installation auf Ihrem PC bzw. im Browser gespeichert und zu keinem Zeitpunkt an fremde Dritte weitergegeben.
                      </li>
                      <li>
                        <strong>Freie Anbieterwahl:</strong> Nutzen Sie den dauerhaft kostenlosen Standard-Tarif von Google Gemini oder binden Sie eigene Zugänge von OpenAI, Anthropic oder lokale KI-Modelle (z. B. via Ollama) ohne Cloud-Kosten an.
                      </li>
                      <li>
                        <strong>App-weite Unterstützung:</strong> Der hinterlegte KI-Dienst steht automatisch in allen Bereichen der Vereinsverwaltung zur Verfügung (Finanzen & Belege, Sitzungen & Protokolle, Notizen sowie Mitgliedsanträge).
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 2: VEREINSSTAMMDATEN */}
      {activeTab === 'club' && (
        <form onSubmit={handleSaveClub} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6 animate-in fade-in duration-150">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vereinslogo Upload Box */}
            <div className="col-span-1 md:col-span-2 p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl">
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

            <div className="col-span-1 md:col-span-2">
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
                Datum Freistellungsbescheid (Gemeinnützigkeit)
              </label>
              <input
                type="text"
                value={formData.taxExemptionDate || ''}
                onChange={e => setFormData({ ...formData, taxExemptionDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. 15.03.2024"
              />
            </div>

            {/* SEPA Creditor & Banking Box */}
            <div className="col-span-1 md:col-span-2 p-4 sm:p-5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-300">
                <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>SEPA-Gläubiger- & Vereinskonto-Stammdaten (für Lastschriften)</span>
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

            {/* Structured Address: Street, House No, Zip, City */}
            <div className="col-span-1 md:col-span-2 p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-3">
              <label className="block text-xs font-bold text-slate-900 dark:text-white">
                Offizielle Vereinsanschrift (Geschäftsstelle / Sitz)
              </label>
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

            {/* Vorstandsmitglieder & Vertretungsberechtigte (§ 26 BGB / Satzung) */}
            <div className="col-span-1 md:col-span-2 p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Vorstand & Vertretungsberechtigte (§ 26 BGB / Satzung)</span>
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-md text-[10px] font-bold">
                        {boardMembers.length} {boardMembers.length === 1 ? 'Mitglied' : 'Mitglieder'}
                      </span>
                    </h4>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Legen Sie alle Vorstandsmitglieder an und benennen Sie deren Ämter frei (z. B. 1. Vorsitzender, 2. Vorsitzende, Schatzmeister, Schriftführer, Sportwart etc.).
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
              <div className="space-y-3">
                {boardMembers.map((bm, idx) => (
                  <div
                    key={bm.id}
                    className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl shadow-2xs space-y-3 transition-all hover:border-slate-350 dark:hover:border-slate-650"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono font-bold flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {bm.role || 'Neues Vorstandsamt'} {bm.name ? `– ${bm.name}` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveBoardMember(idx, 'up')}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            idx === 0
                              ? 'opacity-30 border-slate-200 dark:border-slate-800 cursor-not-allowed text-slate-400'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
                          }`}
                          title="Nach oben verschieben"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === boardMembers.length - 1}
                          onClick={() => handleMoveBoardMember(idx, 'down')}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            idx === boardMembers.length - 1
                              ? 'opacity-30 border-slate-200 dark:border-slate-800 cursor-not-allowed text-slate-400'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
                          }`}
                          title="Nach unten verschieben"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
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
                ))}
              </div>
            </div>

            {/* SMTP-Server & E-Mail-Konfiguration für Sitzungsdienst */}
            <div className="col-span-1 md:col-span-2 p-4 sm:p-5 bg-gradient-to-b from-blue-50/70 to-slate-50/70 dark:from-slate-800/80 dark:to-slate-850/80 border border-blue-200/80 dark:border-slate-700 rounded-2xl space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-200/60 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 shadow-2xs">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        SMTP-Server für den Sitzungsdienst & E-Mail-Versand
                      </h4>
                      {formData.smtpHost ? (
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-md text-[10px] font-bold border border-emerald-300/60 dark:border-emerald-800/60 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Konfiguriert
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-md text-[10px] font-bold border border-amber-300/60 dark:border-amber-800/60">
                          Nicht eingerichtet
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl">
                      Ermöglicht das direkte, DSGVO-konforme Versenden von Sitzungseinladungen, Tagesordnungen und genehmigten Protokollen samt PDF-Anhang direkt aus der App.
                    </p>
                  </div>
                </div>

                {/* Quick Provider Presets */}
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mr-1">
                    Schnellwahl:
                  </span>
                  <button
                    type="button"
                    onClick={() => applySmtpPreset('ionos')}
                    className="px-2 py-1 bg-white dark:bg-slate-750 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    IONOS
                  </button>
                  <button
                    type="button"
                    onClick={() => applySmtpPreset('strato')}
                    className="px-2 py-1 bg-white dark:bg-slate-750 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    Strato
                  </button>
                  <button
                    type="button"
                    onClick={() => applySmtpPreset('gmail')}
                    className="px-2 py-1 bg-white dark:bg-slate-750 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    Gmail
                  </button>
                  <button
                    type="button"
                    onClick={() => applySmtpPreset('gmx')}
                    className="px-2 py-1 bg-white dark:bg-slate-750 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    GMX
                  </button>
                  <button
                    type="button"
                    onClick={() => applySmtpPreset('webde')}
                    className="px-2 py-1 bg-white dark:bg-slate-750 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    Web.de
                  </button>
                  <button
                    type="button"
                    onClick={() => applySmtpPreset('telekom')}
                    className="px-2 py-1 bg-white dark:bg-slate-750 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    Telekom
                  </button>
                </div>
              </div>

              {/* SMTP Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP-Server / Hostname *
                  </label>
                  <input
                    type="text"
                    value={formData.smtpHost || ''}
                    onChange={e => setFormData({ ...formData, smtpHost: e.target.value })}
                    placeholder="z.B. smtp.ionos.de oder mail.ihrverein.de"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Port *
                  </label>
                  <input
                    type="number"
                    value={formData.smtpPort ?? 587}
                    onChange={e => setFormData({ ...formData, smtpPort: parseInt(e.target.value, 10) || 587 })}
                    placeholder="587 oder 465"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Verschlüsselung
                  </label>
                  <select
                    value={formData.smtpSecure ? 'ssl' : 'starttls'}
                    onChange={e => {
                      const isSsl = e.target.value === 'ssl';
                      setFormData({
                        ...formData,
                        smtpSecure: isSsl,
                        smtpPort: isSsl ? 465 : 587
                      });
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="starttls">STARTTLS (Port 587 - Standard)</option>
                    <option value="ssl">SSL / TLS (Port 465)</option>
                  </select>
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP-Benutzername (Login)
                  </label>
                  <input
                    type="text"
                    value={formData.smtpUser || ''}
                    onChange={e => setFormData({ ...formData, smtpUser: e.target.value })}
                    placeholder="z.B. vorstand@tsv-musterstadt1890.de"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP-Passwort / App-Passwort
                  </label>
                  <div className="relative">
                    <input
                      type={showSmtpPassword ? 'text' : 'password'}
                      value={formData.smtpPassword || ''}
                      onChange={e => setFormData({ ...formData, smtpPassword: e.target.value })}
                      placeholder="••••••••••••"
                      className="w-full pl-3 pr-9 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                      title={showSmtpPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                    >
                      {showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Absender-E-Mail (From-Adresse)
                  </label>
                  <input
                    type="email"
                    value={formData.smtpFromEmail || ''}
                    onChange={e => setFormData({ ...formData, smtpFromEmail: e.target.value })}
                    placeholder={formData.email || 'vorstand@tsv-musterstadt1890.de'}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Absender-Name (Anzeigename)
                  </label>
                  <input
                    type="text"
                    value={formData.smtpFromName || ''}
                    onChange={e => setFormData({ ...formData, smtpFromName: e.target.value })}
                    placeholder={formData.clubName || 'TSV Musterstadt 1890 e.V. Vorstand'}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* SMTP Test Actions & Feedback */}
              <div className="pt-3 border-t border-blue-200/60 dark:border-slate-700 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleTestSmtp}
                      disabled={isTestingSmtp || !formData.smtpHost}
                      className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700/80 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                    >
                      {isTestingSmtp ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Verbindung wird geprüft...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>SMTP-Verbindung testen</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowSmtpTestInput(!showSmtpTestInput)}
                      className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer underline"
                    >
                      {showSmtpTestInput ? 'Test-E-Mail Empfänger ausblenden' : '+ Echte Test-E-Mail versenden'}
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Sitzungsdienst nutzt DSGVO-Blindkopie (BCC)
                  </span>
                </div>

                {/* Optional test email recipient input */}
                {showSmtpTestInput && (
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium shrink-0">
                      Test-E-Mail senden an:
                    </span>
                    <input
                      type="email"
                      value={smtpTestEmailInput}
                      onChange={e => setSmtpTestEmailInput(e.target.value)}
                      placeholder="ihre-private-adresse@example.de"
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleTestSmtp}
                      disabled={isTestingSmtp || !smtpTestEmailInput.includes('@')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Jetzt Test senden
                    </button>
                  </div>
                )}

                {/* Test Feedback Message */}
                {smtpTestResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      smtpTestResult.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                    }`}
                  >
                    {smtpTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-bold block">
                        {smtpTestResult.success ? 'Erfolg:' : 'Verbindungsfehler:'}
                      </span>
                      <span>{smtpTestResult.message}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Department configuration with Drag & Drop Sorting */}
          <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Abteilungen & Sparten ({formData.departments.length})</span>
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] rounded-md font-bold">
                    Per Drag & Drop sortierbar
                  </span>
                </label>
                <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ziehen Sie Sparten mit der Maus oder nutzen Sie die Pfeiltasten, um die Reihenfolge festzulegen. Diese Reihenfolge wird in Formularen und Dropdowns verwendet.
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
              {formData.departments.map((dept, index) => {
                const isDragging = draggedDeptIndex === index;
                const isDragOver = dragOverDeptIndex === index;

                return (
                  <div
                    key={dept}
                    draggable
                    onDragStart={e => handleDeptDragStart(e, index)}
                    onDragOver={e => handleDeptDragOver(e, index)}
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
                        className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                        title="Ziehen zum Neuanordnen"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {dept}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 ml-2">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveDepartment(index, 'up')}
                        className={`p-1 rounded-md transition-colors ${
                          index === 0
                            ? 'opacity-25 cursor-not-allowed text-slate-400'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-750 cursor-pointer'
                        }`}
                        title="Nach oben schieben"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === formData.departments.length - 1}
                        onClick={() => handleMoveDepartment(index, 'down')}
                        className={`p-1 rounded-md transition-colors ${
                          index === formData.departments.length - 1
                            ? 'opacity-25 cursor-not-allowed text-slate-400'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-750 cursor-pointer'
                        }`}
                        title="Nach unten schieben"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
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

          {/* Action & Feedback Footer with Prominent Save Button & Instant Notification */}
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
        </form>
      )}

      {/* TAB 3: BENUTZER & RECHTE */}
      {activeTab === 'users' && (
        <div className="space-y-6 animate-in fade-in duration-150">
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

          {/* In-Place User Editor Form */}
          {(isCreatingUser || editingUserId) ? (
            <form
              onSubmit={handleSaveUserForm}
              className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/80 rounded-3xl p-6 shadow-xs space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-xs">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {isCreatingUser
                        ? 'Neues Vereinskonto anlegen'
                        : `Rechte & Daten bearbeiten: ${userFormName || userFormUsername}`}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Passen Sie Zugriffsrechte, Zugangsdaten und Rollenbezeichnung für dieses Vorstandsmitglied an.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={cancelEditUser}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-semibold px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
              </div>

              {/* User Data Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vollständiger Name *
                  </label>
                  <input
                    type="text"
                    value={userFormName}
                    onChange={(e) => setUserFormName(e.target.value)}
                    placeholder="z. B. Sabine Weber"
                    required
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Benutzername (Login) *
                  </label>
                  <input
                    type="text"
                    value={userFormUsername}
                    onChange={(e) => setUserFormUsername(e.target.value)}
                    placeholder="z. B. s.weber oder schatzmeister"
                    required
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Funktion / Rollenbezeichnung
                  </label>
                  <input
                    type="text"
                    value={userFormRole}
                    onChange={(e) => setUserFormRole(e.target.value)}
                    placeholder="z. B. Schatzmeisterin, Kassenprüfer, Geschäftsstelle"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isCreatingUser ? 'Passwort *' : 'Neues Passwort (leer lassen = unverändert)'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={userFormPassword}
                      onChange={(e) => setUserFormPassword(e.target.value)}
                      placeholder={isCreatingUser ? 'Sicheres Passwort vergeben...' : 'Nur ausfüllen bei Änderung'}
                      required={isCreatingUser}
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
                    E-Mail-Adresse (optional)
                  </label>
                  <input
                    type="email"
                    value={userFormEmail}
                    onChange={(e) => setUserFormEmail(e.target.value)}
                    placeholder="kontakt@verein.de"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-3 cursor-pointer bg-slate-50 dark:bg-slate-800 px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl w-full hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={userFormIsActive}
                      onChange={(e) => setUserFormIsActive(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">Konto aktiv</span>
                      <span className="text-2xs text-slate-500 dark:text-slate-400">Benutzer kann sich am System anmelden</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 1-Click Role Presets */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    1-Klick Rollen-Vorlagen:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyPreset('all')}
                      className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-2xs font-bold transition-colors cursor-pointer"
                    >
                      Admin (Vollzugriff)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('finance')}
                      className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-2xs font-bold transition-colors cursor-pointer"
                    >
                      Kassenwart (Finanzen & SEPA)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('members')}
                      className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-2xs font-bold transition-colors cursor-pointer"
                    >
                      Mitgliederwart (Pflege)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('read_only')}
                      className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-2xs font-bold transition-colors cursor-pointer"
                    >
                      Kassenprüfer (Nur Lesen)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('none')}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-2xs font-bold transition-colors cursor-pointer"
                    >
                      Zurücksetzen
                    </button>
                  </div>
                </div>
              </div>

              {/* Granular Permissions Matrix */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Granulare Funktionsberechtigungen:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PERMISSION_ITEMS.map((item) => (
                    <label
                      key={item.key}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                        userFormPermissions[item.key]
                          ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/80 text-blue-950 dark:text-blue-200'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={userFormPermissions[item.key]}
                        onChange={() => toggleUserPermission(item.key)}
                        className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-bold leading-tight">
                          {item.label}
                        </div>
                        <div className="text-2xs opacity-75 mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={cancelEditUser}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  {isCreatingUser ? 'Konto anlegen' : 'Änderungen speichern'}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Vereinsbenutzer & Rollenverwaltung
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Verwalten Sie Login-Zugänge für Vorstände, Abteilungsleiter, Kassenprüfer und Mitarbeiter.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={startCreateUser}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Neuen Benutzer anlegen</span>
                </button>
              </div>

              {/* Users List */}
              <div className="space-y-3">
                {usersList.map((user) => {
                  const permCount = Object.values(user.permissions).filter(Boolean).length;
                  const isFullAdmin = user.permissions.canManageUsers && user.permissions.canManageSettings;

                  return (
                    <div
                      key={user.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs ${
                          isFullAdmin
                            ? 'bg-rose-600 text-white'
                            : user.permissions.canEditFinances
                            ? 'bg-emerald-600 text-white'
                            : 'bg-blue-600 text-white'
                        }`}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {user.name}
                            </span>
                            {user.isActive === false && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                Inaktiv
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="font-mono bg-white dark:bg-slate-700 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-600 text-2xs text-slate-700 dark:text-slate-300">
                              {user.username}
                            </span>
                            {user.customRoleName && (
                              <span className="text-slate-700 dark:text-slate-300 font-semibold truncate">
                                • {user.customRoleName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <span className="text-[11px] px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 font-medium">
                          {isFullAdmin ? 'Vollzugriff (Admin)' : `${permCount} Rechte aktiv`}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEditUser(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                          title="Benutzer bearbeiten"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user)}
                          disabled={usersList.length <= 1}
                          className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Benutzer löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
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

            {/* Legacy Data Rescue Scan */}
            <div className="border border-blue-200 dark:border-blue-900/60 rounded-2xl p-5 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-blue-950 dark:text-blue-200 flex items-center gap-2">
                    <Search className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Notfall-Scan: Altdaten aus früheren Versionen suchen & retten</span>
                  </h4>
                  <p className="text-2xs text-blue-800/80 dark:text-blue-300 mt-1 max-w-xl">
                    Fehlen Ihnen nach einem Update Daten? Dieser Scan durchsucht alle älteren Browser-Datenbanken und früheren Speicherbereiche und führt gefundene Datensätze sicher in die aktuelle Version zusammen.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRunLegacyScan}
                  disabled={isScanningLegacy}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  <Search className={`w-3.5 h-3.5 ${isScanningLegacy ? 'animate-spin' : ''}`} />
                  <span>{isScanningLegacy ? 'Scanne Speicher...' : 'Altdaten-Scan starten'}</span>
                </button>
              </div>

              {legacyScanFeedback && (
                <div className="p-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 animate-in fade-in duration-200">
                  {legacyScanFeedback}
                </div>
              )}
            </div>

            {/* Export Backup Card */}
            <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Vollständige Datensicherung herunterladen (JSON)</span>
                </h4>
                <p className="text-2xs sm:text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                  Exportiert alle Mitglieder, Kassenbuchungen, Belegdateien, Konten, Spendenquittungen, Anträge und Revisionsprotokolle in eine unverschlüsselte JSON-Datei.
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
                <span>Datenbankverwaltung & Zurücksetzen</span>
              </h4>
              <p className="text-2xs text-rose-800 dark:text-rose-300">
                Verwenden Sie diese Aktionen, um zu Testzwecken Beispieldaten zu laden oder den lokalen Datenbestand vollständig zu leeren.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleResetToDemo}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Musterdaten laden (TSV Musterstadt)</span>
                </button>

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

      {/* TAB 5: BETRIEBSMODI & DEPLOYMENT HUB */}
      {activeTab === 'deployment' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <DeploymentHubSettingsPanel
            currentMode={currentDepMode}
            onModeChange={handleModeChange}
            onDataReload={onDataReload}
          />
        </div>
      )}

      {/* TAB 6: PROJEKT UNTERSTÜTZEN & SPENDEN */}
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
            {/* Left: PayPal QR Code Card (5 cols) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col items-center text-center space-y-5">
              <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-white">
                    PayPal Spenden-QR-Code
                  </span>
                </div>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Direkt & Sicher
                </span>
              </div>

              {/* Embedded QR Code Image - Size matched to frame and Clickable with Zoom Preview */}
              <div
                onClick={() => setQrModalOpen(true)}
                className="w-full max-w-[280px] sm:max-w-[320px] aspect-square bg-white rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm relative group cursor-pointer overflow-hidden p-2 flex items-center justify-center transition-all duration-200 hover:border-blue-500 hover:shadow-md"
                title="Klicken, um den QR-Code vergrößert anzuzeigen"
              >
                <img
                  src={paypalQrImage}
                  alt="PayPal QR Code zur finanziellen Projektunterstützung"
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
                  Mit Smartphone oder PayPal-App scannen
                </p>
                <p className="text-2xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                  Öffnen Sie Ihre Smartphone-Kamera oder die PayPal-App und richten Sie sie auf den QR-Code, um einen beliebigen Betrag zu spenden.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="w-full pt-3 flex flex-col sm:flex-row gap-2 border-t border-slate-100 dark:border-slate-800">
                <a
                  href="https://paypal.me/strelitzerfc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Direkt zu PayPal</span>
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
                  href={paypalQrImage}
                  download="paypal-original.jpg"
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
      {/* TAB 7: BUGREPORTING & PROBLEM MELDEN                                      */}
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
          {submittedTicket && (
            <div className="p-5 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700/80 rounded-3xl text-xs text-emerald-900 dark:text-emerald-200 shadow-xs space-y-3 animate-in fade-in duration-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-xs">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
                      <span>Fehlerbericht direkt aus der App versendet!</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 text-2xs font-mono font-bold">
                        #{submittedTicket.ticketId}
                      </span>
                    </div>
                    <p className="text-2xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                      Erfolgreich übermittelt am {submittedTicket.timestamp}. Kein externes E-Mail-Programm erforderlich.
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
                      <option value="Einstellungen: 1. Allgemeine Einstellungen">⚙️ Einstellungen: 1. Allgemeine Einstellungen</option>
                      <option value="Einstellungen: 2. Vereinsstammdaten">🏛️ Einstellungen: 2. Vereinsstammdaten & Logo</option>
                      <option value="Einstellungen: 3. Benutzer & Rechte">🛡️ Einstellungen: 3. Benutzerkonten & Zugriffsrechte</option>
                      <option value="Einstellungen: 4. Datensicherung & Import">💾 Einstellungen: 4. Datensicherung & Import</option>
                      <option value="Einstellungen: 5. Betriebsmodi">🌐 Einstellungen: 5. Betriebsmodi & Deployment Hub</option>
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
                    <UserIcon className="w-4 h-4 text-slate-500" />
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
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
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
                          {bugCopied ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                          <span>{bugCopied ? 'Kopiert!' : 'Kopieren'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleResetBugForm}
                          className="h-8 px-3 bg-transparent hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl text-2xs font-semibold border border-transparent transition-colors flex items-center justify-center cursor-pointer whitespace-nowrap"
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
                  <div><span className="text-slate-500">App-Version:</span> v{CURRENT_APP_VERSION}</div>
                  <div><span className="text-slate-500">Betriebsmodus:</span> {currentDepMode}</div>
                  <div><span className="text-slate-500">Plattform:</span> {typeof navigator !== 'undefined' ? (navigator.userAgent.includes('Windows') ? 'Windows' : navigator.userAgent.includes('Mac') ? 'macOS' : navigator.userAgent.includes('Linux') ? 'Linux' : 'Web/Mobil') : 'Web'}</div>
                  <div><span className="text-slate-500">Auflösung:</span> {typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'n/a'}</div>
                  <div><span className="text-slate-500">Sprache:</span> {typeof navigator !== 'undefined' ? navigator.language : 'de-DE'}</div>
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
                <span>PayPal Spenden-QR-Code</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Direkt mit PayPal scannen
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                Richten Sie die Smartphone-Kamera oder die PayPal-App auf das Bild.
              </p>
            </div>

            {/* High-Resolution Large QR Display */}
            <div className="w-72 h-72 sm:w-80 sm:h-80 bg-white p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-inner flex items-center justify-center">
              <img
                src={paypalQrImage}
                alt="PayPal QR Code vergrößert"
                className="w-full h-full object-contain rounded-xl select-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href="https://paypal.me/strelitzerfc"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Auf PayPal öffnen</span>
              </a>
              <a
                href={paypalQrImage}
                download="paypal-original.jpg"
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
                      <Check className="w-3 h-3 text-emerald-600" />
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
    </div>
  );
};
