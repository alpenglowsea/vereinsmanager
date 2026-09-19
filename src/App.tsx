/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import {
  Member,
  Transaction,
  FinancialAccount,
  ClubSettings,
  ReceiptAttachment,
  InventoryItem,
  MemberBulkUpdates,
  TransactionBulkUpdates,
  InventoryBulkUpdates,
  ClubDocument,
  DocumentCategory,
  DocumentFolder,
  DonationReceipt,
  CalendarEvent,
  CalendarEventCategory,
  OnlineMembershipApplication,
  ApplicationTemplateSettings,
  ClubContact,
  ContactType,
  ClubInvoice,
  InvoiceTemplateSettings,
  Meeting,
  MeetingTemplateSettings
} from './types';
import { StorageService } from './services/storage';
import { PublicClubInfo, fetchPublicClubInfo, isCloudModeActive } from './services/supabaseClient';
import { CloudStorageService } from './services/cloudStorage';
import { AuthService } from './services/authService';
import { PermissionArea, UserAuthSession, UserPermissions } from './types';
import { AREA_LABEL, canEdit, canView, migrateLegacyPermissions } from './utils/permissions';
import { formatClubAddress } from './utils/clubAddress';
import { UserDashboardConfig } from './types/dashboard';
import { DEFAULT_DASHBOARD_CONFIG } from './data/defaultDashboard';
import { DEFAULT_MEETING_TEMPLATE } from './data/initialMeetings';
import { createDocumentFromInvoice, downloadInvoicePdf } from './services/invoicePdfService';
import './services/customCategoryService';

// Views
import { DashboardView } from './components/DashboardView';
import { MembersView } from './components/MembersView';
import { MemberAnalyticsView } from './components/MemberAnalyticsView';
import { FinanceView } from './components/FinanceView';
import { GuvReportView } from './components/GuvReportView';
import { FinanceAnalyticsView } from './components/FinanceAnalyticsView';
import { InvoicesView } from './components/InvoicesView';
import { DonationsView } from './components/DonationsView';
import { ContactsView } from './components/ContactsView';
import { InventoryView } from './components/InventoryView';
import { SepaRunView } from './components/SepaRunView';
import { DocumentsView } from './components/DocumentsView';
import { CalendarView } from './components/CalendarView';
import { OnlineApplicationsView } from './components/OnlineApplicationsView';
import { MeetingsView } from './components/MeetingsView';
import { PublicApplicationForm } from './components/PublicApplicationForm';
import { MemberSurveysView } from './components/MemberSurveysView';
import { PublicSurveyView } from './components/PublicSurveyView';

// Modals & Drawers
import { DashboardConfigModal } from './components/DashboardConfigModal';
import { MemberFormModal } from './components/MemberFormModal';
import { MemberDetailsDrawer } from './components/MemberDetailsDrawer';
import { MemberImportModal } from './components/MemberImportModal';
import { ContactFormModal } from './components/ContactFormModal';
import { ContactDetailsModal } from './components/ContactDetailsModal';
import { ContactImportModal } from './components/ContactImportModal';
import { TransactionFormModal } from './components/TransactionFormModal';
import { TransactionImportModal } from './components/TransactionImportModal';
import { BankImportModal } from './components/BankImportModal';
import { AccountManageModal } from './components/AccountManageModal';
import { InvoiceFormModal } from './components/InvoiceFormModal';
import { InvoiceDetailsModal } from './components/InvoiceDetailsModal';
import { InvoiceTemplateModal } from './components/InvoiceTemplateModal';
import { ReceiptViewerModal } from './components/ReceiptViewerModal';
import { ReceiptCameraScannerModal } from './components/ReceiptCameraScannerModal';
import { SettingsView } from './components/SettingsView';
import { InventoryFormModal } from './components/InventoryFormModal';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import { DocumentUploadModal } from './components/DocumentUploadModal';
import { DocumentEditModal } from './components/DocumentEditModal';
import { NewDocumentChoiceModal } from './components/NewDocumentChoiceModal';
import { DonationFormModal } from './components/DonationFormModal';
import { MeetingFormModal } from './components/MeetingFormModal';
import { CalendarEventModal } from './components/CalendarEventModal';
import { LoginScreen } from './components/LoginScreen';
import { UserManageModal } from './components/UserManageModal';
import { AppVersionBadge } from './components/AppVersionBadge';

// Icons
import {
  LayoutDashboard,
  Users,
  BarChart3,
  CreditCard,
  Wallet,
  FileSpreadsheet,
  PieChart,
  Settings,
  Menu,
  X,
  Lock,
  Package,
  ChevronDown,
  ChevronRight,
  FolderArchive,
  FileText,
  HeartHandshake,
  LogOut,
  ShieldAlert,
  UserCog,
  CalendarDays,
  FileSignature,
  SlidersHorizontal,
  Contact,
  ScrollText,
  Vote
} from 'lucide-react';

/**
 * Die Menüpunkte der Navigationsleiste. Absichtlich aus PermissionArea
 * abgeleitet: So kann kein Menüpunkt entstehen, für den es keine
 * Berechtigung gibt (und umgekehrt). 'users' ist kein eigener Menüpunkt,
 * sondern ein Reiter innerhalb der Einstellungen.
 */
type ActiveTab = Exclude<PermissionArea, 'users'>;

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [settingsActiveTab, setSettingsActiveTab] = useState<'general' | 'club' | 'users' | 'backup' | 'deployment' | 'support' | 'bugreport'>('general');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deploymentMode, setDeploymentMode] = useState<import('./types').DeploymentMode>(StorageService.getDeploymentMode());

  // Theme Management (Light, Dark, System)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('vereinsmanager_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    return 'light';
  });

  useEffect(() => {
    localStorage.setItem('vereinsmanager_theme', theme);
    const root = document.documentElement;
    const applyTheme = () => {
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };
    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  // Authentication & RBAC State
  const [authSession, setAuthSession] = useState<UserAuthSession>(() => AuthService.getSession());

  /** Meldung, wenn eine Aktion an der fehlenden Berechtigung scheitert. */
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);

  /**
   * Vereinsangaben für das öffentliche Antragsformular.
   *
   * Im Cloud-Betrieb kommt ein Besucher ohne Anmeldung an keine Tabelle heran.
   * Für das Formular reicht eine Handvoll Angaben — die liefert die Datenbank
   * über eine eigene Funktion, die nur diese Felder herausgibt.
   */
  const [publicClubInfo, setPublicClubInfo] = useState<PublicClubInfo | null>(null);

  // Hinweis von selbst wieder ausblenden.
  useEffect(() => {
    if (!permissionNotice) return;
    const timer = setTimeout(() => setPermissionNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [permissionNotice]);
  const [userManageOpen, setUserManageOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Core App State
  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [documents, setDocuments] = useState<ClubDocument[]>([]);
  const [donations, setDonations] = useState<DonationReceipt[]>([]);
  const [onlineApplications, setOnlineApplications] = useState<OnlineMembershipApplication[]>([]);
  const [applicationSettings, setApplicationSettings] = useState<ApplicationTemplateSettings>({
    headerText: 'Herzlich willkommen beim TSV Musterstadt 1890 e.V.! Füllen Sie den Online-Aufnahmeantrag bitte vollständig aus.',
    notificationEmail: 'vorstand@tsv-musterstadt1890.de',
    defaultFeeRules: { full: 18.0, reduced: 12.0, youth: 10.0, family: 30.0, supporting: 25.0 },
    requirePhotoConsent: true,
    requireHealthConfirmation: true
  });
  const [isPublicFormMode, setIsPublicFormMode] = useState<boolean>(() => {
    // Genau prüfen statt nur "enthält irgendwo das Wort": Seit das Formular
    // ohne Anmeldung erreichbar ist, entscheidet dieser Wert darüber, ob ein
    // Besucher das Antragsformular oder das Anmeldefenster sieht. Ein
    // zufälliger Parameter wie "?platform=..." darf das nicht auslösen.
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const view = (params.get('view') || '').toLowerCase();
    return view === 'antrag' || view === 'form' || params.has('antrag');
  });
  const [publicSurveyParams, setPublicSurveyParams] = useState<{ surveyId: string; token?: string } | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sId = params.get('surveyId') || params.get('survey') || params.get('umfrage');
      if (sId) {
        return {
          surveyId: sId,
          token: params.get('token') || undefined
        };
      }
    }
    return null;
  });
  const [settings, setSettings] = useState<ClubSettings>({
    clubName: 'TSV Musterstadt 1890 e.V.',
    associationNumber: 'VR 48219 Amtsgericht Musterstadt',
    taxNumber: '112/5840/1922',
    creditorId: 'DE98ZZZ09999999999',
    address: 'Sportplatzweg 12, 12345 Musterstadt',
    chairman: 'Dr. Michael Sommer',
    treasurer: 'Sabine Weber',
    email: '',
    departments: ['Fußball', 'Tennis', 'Turnen', 'Leichtathletik', 'Schwimmen', 'Volleyball'],
    currency: 'EUR'
  });

  // Modal States
  const [memberFormOpen, setMemberFormOpen] = useState(false);
  const [memberImportOpen, setMemberImportOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [detailsMember, setDetailsMember] = useState<Member | null>(null);

  const [txFormOpen, setTxFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const [donationFormOpen, setDonationFormOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState<DonationReceipt | null>(null);

  // Contacts Management State
  const [contacts, setContacts] = useState<ClubContact[]>([]);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [contactImportOpen, setContactImportOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ClubContact | null>(null);
  const [detailsContact, setDetailsContact] = useState<ClubContact | null>(null);
  const [initialContactFormName, setInitialContactFormName] = useState<string>('');
  const [initialContactFormType, setInitialContactFormType] = useState<ContactType | undefined>(undefined);
  const [initialBookingPartner, setInitialBookingPartner] = useState<string>('');

  const [receiptScannerOpen, setReceiptScannerOpen] = useState(false);
  const [scannerTargetTx, setScannerTargetTx] = useState<Transaction | null>(null);

  const [inventoryFormOpen, setInventoryFormOpen] = useState(false);
  const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryItem | null>(null);

  const [bankImportOpen, setBankImportOpen] = useState(false);
  const [transactionImportOpen, setTransactionImportOpen] = useState(false);
  const [accountManageOpen, setAccountManageOpen] = useState(false);

  // Invoices Management States
  const [invoices, setInvoices] = useState<ClubInvoice[]>([]);
  const [invoiceTemplateSettings, setInvoiceTemplateSettings] = useState<InvoiceTemplateSettings>({
    templateName: 'Standard',

    // Seitenränder in mm. marginTop steuert im PDF-Dienst die Position des
    // Adressfeldes, wenn eigenes Briefpapier hinterlegt ist.
    marginTop: 45,
    marginBottom: 20,
    marginLeft: 25,
    marginRight: 20,

    defaultIntroText: 'für Ihre Mitgliedschaft in unserem Verein stellen wir Ihnen folgende Positionen in Rechnung:',
    defaultOutroText: 'Vielen Dank für Ihre Unterstützung unseres Vereins!',
    defaultPaymentTermsDays: 14,
    defaultDueNotice: 'Bitte überweisen Sie den Rechnungsbetrag bis zum angegebenen Fälligkeitsdatum auf das unten genannte Vereinskonto.',

    showClubLogo: true,
    showFoldingMarks: true,
    showGiroCode: true,
    accentColor: '#2563eb',
    customBlankoDataUrl: ''
  });
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<ClubInvoice | null>(null);
  const [detailsInvoice, setDetailsInvoice] = useState<ClubInvoice | null>(null);
  const [invoiceTemplateModalOpen, setInvoiceTemplateModalOpen] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingTemplateSettings, setMeetingTemplateSettings] = useState<MeetingTemplateSettings>(DEFAULT_MEETING_TEMPLATE);
  const [prefillInvoiceRecipient, setPrefillInvoiceRecipient] = useState<{
    id?: string;
    name?: string;
    type?: 'member' | 'contact' | 'custom';
    company?: string;
    contactPerson?: string;
    email?: string;
    address?: {
      street?: string;
      houseNumber?: string;
      zip?: string;
      city?: string;
      country?: string;
    };
  } | null>(null);

  // Calendar Event Modal State
  const [calendarEventModalOpen, setCalendarEventModalOpen] = useState(false);
  const [calendarCategories, setCalendarCategories] = useState<CalendarEventCategory[]>([]);
  // Wird nach jedem gespeicherten Termin hochgezählt, damit die
  // Dashboard-Kachel ihre Liste neu lädt.
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

  // Meeting Form Modal State (Dashboard Schnellaktion & Global Modal)
  const [meetingFormOpen, setMeetingFormOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  // Document Management States
  const [newDocChoiceOpen, setNewDocChoiceOpen] = useState(false);
  const [docUploadOpen, setDocUploadOpen] = useState(false);
  const [docUploadCategory, setDocUploadCategory] = useState<DocumentCategory | undefined>(undefined);
  const [docUploadFolderId, setDocUploadFolderId] = useState<string | null>(null);
  const [docScannerOpen, setDocScannerOpen] = useState(false);
  const [docViewerItem, setDocViewerItem] = useState<ClubDocument | null>(null);
  const [docEditItem, setDocEditItem] = useState<ClubDocument | null>(null);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);

  // Modular Dashboard Configuration State
  const [dashboardConfig, setDashboardConfig] = useState<UserDashboardConfig>(DEFAULT_DASHBOARD_CONFIG);
  const [isDashboardConfigOpen, setIsDashboardConfigOpen] = useState(false);

  // Submenu expansion states - collapsed by default, expand on click
  const [membersMenuOpen, setMembersMenuOpen] = useState(false);
  const [financeMenuOpen, setFinanceMenuOpen] = useState(false);

  const [activeReceipt, setActiveReceipt] = useState<{
    receipt: ReceiptAttachment;
    docNum: string;
    text: string;
  } | null>(null);

  // Load initial data from local IndexedDB
  const loadData = async () => {
    // Ein Besucher auf dem öffentlichen Antragsformular ist nicht angemeldet.
    // Im Cloud-Betrieb weist die Datenbank ihn bei jeder Tabelle zurück — das
    // wäre eine Bildschirmseite voller Fehlermeldungen für Daten, die er
    // ohnehin nicht sehen soll. Für das Formular genügt vm_public_club_info().
    if (
      isPublicFormMode &&
      !AuthService.getSession().isAuthenticated &&
      StorageService.getDeploymentMode() === 'cloud'
    ) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      await StorageService.init();
      const [
        loadedMembers,
        loadedTransactions,
        loadedAccounts,
        loadedInventory,
        loadedSettings,
        loadedDocuments,
        loadedDonations,
        loadedFolders,
        loadedApplications,
        loadedTemplateSettings,
        loadedDashboardConfig,
        loadedContacts,
        loadedInvoices,
        loadedInvoiceTemplate,
        loadedMeetings,
        loadedMeetingTemplate
      ] = await Promise.all([
        StorageService.getMembers(),
        StorageService.getTransactions(),
        StorageService.getAccounts(),
        StorageService.getInventory(),
        StorageService.getSettings(),
        StorageService.getDocuments(),
        StorageService.getDonations(),
        StorageService.getFolders(),
        StorageService.getOnlineApplications(),
        StorageService.getApplicationTemplateSettings(),
        StorageService.getDashboardConfig(),
        StorageService.getContacts(),
        StorageService.getInvoices(),
        StorageService.getInvoiceTemplate(),
        StorageService.getMeetings(),
        StorageService.getMeetingTemplate()
      ]);

      setMembers(loadedMembers);
      setTransactions(loadedTransactions);
      setAccounts(loadedAccounts);
      setInventory(loadedInventory);
      setSettings(loadedSettings);
      setDocuments(loadedDocuments);
      setDonations(loadedDonations);
      setFolders(loadedFolders);
      setOnlineApplications(loadedApplications);
      setContacts(loadedContacts);
      setInvoices(loadedInvoices);
      if (loadedInvoiceTemplate) {
        setInvoiceTemplateSettings(loadedInvoiceTemplate);
      }
      setMeetings(loadedMeetings);
      if (loadedMeetingTemplate) {
        setMeetingTemplateSettings(loadedMeetingTemplate);
      }
      if (loadedDashboardConfig) {
        setDashboardConfig(loadedDashboardConfig);
      }
      if (loadedTemplateSettings) {
        setApplicationSettings(loadedTemplateSettings);
      }
    } catch (err) {
      console.error('Failed to load local data:', err);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------
  // Berechtigungen des angemeldeten Benutzers
  //
  // WICHTIG: Das ist eine Bedienhilfe, keine Sicherheitsgrenze. Alles läuft
  // im Browser des Nutzers und lässt sich dort umgehen. Verbindlich schützen
  // kann nur der Server (Supabase Row Level Security).
  // ---------------------------------------------------------------------

  /**
   * Ohne angemeldeten Benutzer (Anmeldung abgeschaltet) gilt Vollzugriff —
   * sonst wäre die Anwendung ohne Anmeldung unbedienbar. Gespeicherte Konten
   * im alten Format werden beim Lesen übersetzt.
   */
  const userPermissions: UserPermissions = migrateLegacyPermissions(
    authSession.user?.permissions
  );

  /** Darf der Benutzer diesen Menüpunkt öffnen? */
  const mayAccess = (tab: ActiveTab): boolean => canView(userPermissions, tab);

  /** Darf der Benutzer in diesem Bereich etwas ändern? */
  const mayEdit = (area: PermissionArea): boolean => canEdit(userPermissions, area);

  /**
   * Schreibsperre. Steht als erste Zeile in jeder ändernden Funktion.
   *
   * Absichtlich hier und nicht an den Knöpfen: Ein übersehener Knopf wäre
   * eine offene Tür. Hier kommt jeder Weg vorbei — auch der über eine
   * Kachel, einen Querverweis oder eine Massenaktion.
   */
  const requireEdit = (area: PermissionArea): boolean => {
    if (mayEdit(area)) return true;
    setPermissionNotice(
      `Keine Berechtigung zum Bearbeiten: ${AREA_LABEL[area]}. ` +
        'Wenden Sie sich an den Vorstand, wenn Sie hier Änderungen vornehmen müssen.'
    );
    return false;
  };

  const handleSaveMeeting = async (meeting: Meeting) => {
    if (!requireEdit('meetings')) return;
    const saved = await StorageService.saveMeeting(meeting);
    setMeetings(prev => {
      const idx = prev.findIndex(m => m.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!requireEdit('meetings')) return;
    await StorageService.deleteMeeting(meetingId);
    setMeetings(prev => prev.filter(m => m.id !== meetingId));
  };

  const handleSaveMeetingTemplate = async (template: MeetingTemplateSettings) => {
    if (!requireEdit('meetings')) return;
    const saved = await StorageService.saveMeetingTemplate(template);
    setMeetingTemplateSettings(saved);
  };

  // Angaben für das öffentliche Antragsformular nachladen, sobald klar ist,
  // dass ein Besucher ohne Anmeldung davorsteht.
  useEffect(() => {
    if (!isPublicFormMode || authSession.isAuthenticated) return;
    if (StorageService.getDeploymentMode() !== 'cloud') return;

    let abgebrochen = false;
    fetchPublicClubInfo().then(info => {
      if (!abgebrochen) setPublicClubInfo(info);
    });
    return () => {
      abgebrochen = true;
    };
  }, [isPublicFormMode, authSession.isAuthenticated]);

  // Verweis auf die jeweils aktuelle Fassung von loadData.
  //
  // Der Starteffekt weiter unten darf genau EINMAL laufen: Er meldet die
  // Anmeldung an und hängt drei Ereignisbehandlungen ans Fenster. Liefe er
  // erneut, kämen sie ein zweites Mal dazu.
  //
  // Damit darf loadData nicht in seiner Abhängigkeitsliste stehen — die
  // Funktion entsteht bei jedem Rendern neu, der Effekt liefe also bei jedem
  // Rendern. Sie einfach wegzulassen, wäre aber auch falsch: Der Effekt
  // behielte für immer die allererste Fassung, mitsamt den Werten, die beim
  // ersten Rendern galten.
  //
  // Die Referenz löst beides: Sie ist selbst unveränderlich (deshalb gehört
  // sie in keine Abhängigkeitsliste), zeigt aber immer auf die neueste
  // Fassung. Sie muss ÜBER dem Effekt stehen, der sie benutzt.
  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  });

  useEffect(() => {
    let isMounted = true;

    AuthService.init().then(async session => {
      if (!isMounted) return;
      setAuthSession(session);
      if (session.isAuthenticated) {
        setActiveTab('dashboard');
      }
      await loadDataRef.current();
    });

    const unsubscribe = AuthService.onAuthStateChanged(async session => {
      if (!isMounted) return;
      setAuthSession(prev => {
        if (!prev.isAuthenticated && session.isAuthenticated) {
          setActiveTab('dashboard');
        }
        return session;
      });
      await loadDataRef.current();
    });

    const handleUserActivity = () => {
      AuthService.recordActivity();
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);

    return () => {
      isMounted = false;
      unsubscribe();
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
    };
  }, []);

  // Compute Next Member Number & Next Doc Number
  const nextMemberNumber = `M-${String(members.length + 101).padStart(4, '0')}`;
  const nextDocNumber = `BE-${new Date().getFullYear()}-${String(transactions.length + 1).padStart(3, '0')}`;

  // Nächste freie Kontaktnummer (Format K-1001, wie im Bestand).
  // Bewusst aus der höchsten bereits vergebenen Nummer abgeleitet und
  // nicht aus der Anzahl: Nach dem Löschen eines Kontakts würde eine
  // anzahlbasierte Berechnung eine bereits vergebene Nummer erneut
  // ausgeben.
  const nextContactNumber = `K-${String(
    contacts.reduce((max, c) => {
      const parsed = Number.parseInt((c.contactNumber || '').replace(/\D/g, ''), 10);
      return Number.isFinite(parsed) && parsed > max ? parsed : max;
    }, 1000) + 1
  ).padStart(4, '0')}`;

  // Member CRUD handlers
  const handleSaveMember = async (memberData: Member, attachedDoc?: ClubDocument) => {
    if (!requireEdit('members')) return;
    const isNew = !members.some(m => m.id === memberData.id);
    await StorageService.saveMember(memberData, isNew ? 'Mitglied neu angelegt' : 'Stammdaten aktualisiert');
    const updated = await StorageService.getMembers();
    setMembers(updated);

    if (attachedDoc) {
      const updatedDocs = await StorageService.getDocuments();
      setDocuments(updatedDocs);
    }

    setMemberFormOpen(false);
    setEditingMember(null);

    // If currently viewing in drawer, refresh drawer target
    if (detailsMember?.id === memberData.id) {
      setDetailsMember(memberData);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!requireEdit('members')) return;
    await StorageService.deleteMember(id);
    const updated = await StorageService.getMembers();
    setMembers(updated);
    if (detailsMember?.id === id) {
      setDetailsMember(null);
    }
  };

  const handleBulkUpdateMembers = async (ids: string[], updates: MemberBulkUpdates) => {
    if (!requireEdit('members')) return;
    await StorageService.bulkUpdateMembers(ids, updates);
    const updated = await StorageService.getMembers();
    setMembers(updated);
    if (detailsMember && ids.includes(detailsMember.id)) {
      const refreshed = updated.find(m => m.id === detailsMember.id);
      if (refreshed) setDetailsMember(refreshed);
    }
  };

  const handleBulkDeleteMembers = async (ids: string[]) => {
    if (!requireEdit('members')) return;
    await StorageService.deleteMultipleMembers(ids);
    const updated = await StorageService.getMembers();
    setMembers(updated);
    if (detailsMember && ids.includes(detailsMember.id)) {
      setDetailsMember(null);
    }
  };

  // Batch Member CSV Import
  const handleBatchMemberImport = async (importedMembers: Member[]) => {
    if (!requireEdit('members')) return;
    await StorageService.batchSaveMembers(importedMembers);
    const updated = await StorageService.getMembers();
    setMembers(updated);
  };

  // Contact CRUD handlers
  const handleSaveContact = async (contactData: ClubContact) => {
    if (!requireEdit('contacts')) return;
    await StorageService.saveContact(contactData);
    const updated = await StorageService.getContacts();
    setContacts(updated);
    setContactFormOpen(false);
    setEditingContact(null);
    setInitialContactFormName('');
    setInitialContactFormType(undefined);
    if (detailsContact?.id === contactData.id) {
      setDetailsContact(contactData);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!requireEdit('contacts')) return;
    await StorageService.deleteContact(id);
    const updated = await StorageService.getContacts();
    setContacts(updated);
    if (detailsContact?.id === id) {
      setDetailsContact(null);
    }
  };

  const handleBulkDeleteContacts = async (ids: string[]) => {
    if (!requireEdit('contacts')) return;
    for (const id of ids) {
      await StorageService.deleteContact(id);
    }
    const updated = await StorageService.getContacts();
    setContacts(updated);
    if (detailsContact && ids.includes(detailsContact.id)) {
      setDetailsContact(null);
    }
  };

  const handleBatchImportContacts = async (importedContacts: ClubContact[]) => {
    if (!requireEdit('contacts')) return;
    for (const c of importedContacts) {
      await StorageService.saveContact(c);
    }
    const updated = await StorageService.getContacts();
    setContacts(updated);
  };

  const handleQuickCreateContact = (initialName: string, initialType?: ContactType) => {
    if (!requireEdit('contacts')) return;
    setEditingContact(null);
    setInitialContactFormName(initialName);
    setInitialContactFormType(initialType);
    setContactFormOpen(true);
  };

  // Transaction CRUD handlers
  const handleSaveTransaction = async (txData: Transaction) => {
    if (!requireEdit('finance')) return;
    await StorageService.saveTransaction(txData);
    const updated = await StorageService.getTransactions();
    setTransactions(updated);
    setTxFormOpen(false);
    setEditingTx(null);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!requireEdit('finance')) return;
    await StorageService.deleteTransaction(id);
    const updated = await StorageService.getTransactions();
    setTransactions(updated);
  };

  const handleBulkUpdateTransactions = async (ids: string[], updates: TransactionBulkUpdates) => {
    if (!requireEdit('finance')) return;
    await StorageService.bulkUpdateTransactions(ids, updates);
    const updated = await StorageService.getTransactions();
    setTransactions(updated);
  };

  const handleBulkDeleteTransactions = async (ids: string[]) => {
    if (!requireEdit('finance')) return;
    await StorageService.deleteMultipleTransactions(ids);
    const updated = await StorageService.getTransactions();
    setTransactions(updated);
  };

  // Camera Receipt Scanner Handlers
  const handleScannerLinkToTransaction = async (transactionId: string, receipt: ReceiptAttachment) => {
    if (!requireEdit('finance')) return;
    const targetTx = transactions.find(t => t.id === transactionId);
    if (!targetTx) return;
    const updatedTx: Transaction = {
      ...targetTx,
      receipt,
      updatedAt: new Date().toISOString()
    };
    await StorageService.saveTransaction(updatedTx);
    const updated = await StorageService.getTransactions();
    setTransactions(updated);
    setReceiptScannerOpen(false);
    setScannerTargetTx(null);
  };

  const handleScannerCreateTransactionWithReceipt = (receipt: ReceiptAttachment) => {
    if (!requireEdit('finance')) return;
    const newTxStub: Transaction = {
      id: `tx-${Date.now()}`,
      documentNumber: nextDocNumber,
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      type: 'expense',
      sphere: 'ideell',
      category: 'Sportbetrieb & Ausrüstung',
      partner: '',
      bookingText: 'Digitalisierter Beleg',
      accountId: accounts[0]?.id || 'acc-1',
      vatRate: 0,
      receipt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEditingTx(newTxStub);
    setTxFormOpen(true);
    setReceiptScannerOpen(false);
    setScannerTargetTx(null);
  };

  const handleQuickScanReceipt = (tx: Transaction) => {
    if (!requireEdit('finance')) return;
    setScannerTargetTx(tx);
    setReceiptScannerOpen(true);
  };

  // Bank CSV Batch Import
  const handleBankImport = async (importedTxs: Transaction[]) => {
    if (!requireEdit('finance')) return;
    await StorageService.batchSaveTransactions(importedTxs);
    const updated = await StorageService.getTransactions();
    setTransactions(updated);
  };

  // Excel & Google Sheets Batch Import
  const handleBatchTransactionImport = async (importedTxs: Transaction[]) => {
    if (!requireEdit('finance')) return;
    await StorageService.batchSaveTransactions(importedTxs);
    const updated = await StorageService.getTransactions();
    setTransactions(updated);
  };

  // Account handlers
  const handleSaveAccount = async (account: FinancialAccount) => {
    if (!requireEdit('finance')) return;
    await StorageService.saveAccount(account);
    const updated = await StorageService.getAccounts();
    setAccounts(updated);
  };

  const handleDeleteAccount = async (id: string) => {
    if (!requireEdit('finance')) return;
    await StorageService.deleteAccount(id);
    const updated = await StorageService.getAccounts();
    setAccounts(updated);
  };

  const handleReorderAccounts = async (reordered: FinancialAccount[]) => {
    if (!requireEdit('finance')) return;
    const withOrder = reordered.map((a, idx) => ({ ...a, order: idx }));
    setAccounts(withOrder);
    await StorageService.saveAccounts(withOrder);
  };

  // Inventory CRUD handlers
  const handleSaveInventoryItem = async (item: InventoryItem) => {
    if (!requireEdit('inventory')) return;
    await StorageService.saveInventoryItem(item);
    const updated = await StorageService.getInventory();
    setInventory(updated);
    setInventoryFormOpen(false);
    setEditingInventoryItem(null);
  };

  const handleDeleteInventoryItem = async (id: string) => {
    if (!requireEdit('inventory')) return;
    await StorageService.deleteInventoryItem(id);
    const updated = await StorageService.getInventory();
    setInventory(updated);
  };

  const handleBulkUpdateInventoryItems = async (ids: string[], updates: InventoryBulkUpdates) => {
    if (!requireEdit('inventory')) return;
    await StorageService.bulkUpdateInventoryItems(ids, updates);
    const updated = await StorageService.getInventory();
    setInventory(updated);
  };

  const handleBulkDeleteInventoryItems = async (ids: string[]) => {
    if (!requireEdit('inventory')) return;
    await StorageService.deleteMultipleInventoryItems(ids);
    const updated = await StorageService.getInventory();
    setInventory(updated);
  };

  // Settings handler
  const handleSaveSettings = async (newSettings: ClubSettings) => {
    if (!requireEdit('settings')) return;
    await StorageService.saveSettings(newSettings);
    setSettings(newSettings);
  };

  // Document Management handlers
  const handleSaveBatchDocuments = async (newDocs: ClubDocument[]) => {
    if (!requireEdit('documents')) return;
    await StorageService.saveBatchDocuments(newDocs);
    const updated = await StorageService.getDocuments();
    setDocuments(updated);
  };

  const handleSaveSingleDocument = async (doc: ClubDocument) => {
    if (!requireEdit('documents')) return;
    await StorageService.saveDocument(doc);
    const updated = await StorageService.getDocuments();
    setDocuments(updated);
  };

  const handleUpdateDocument = async (updatedDoc: ClubDocument) => {
    if (!requireEdit('documents')) return;
    await StorageService.saveDocument(updatedDoc);
    const updated = await StorageService.getDocuments();
    setDocuments(updated);
    if (docViewerItem?.id === updatedDoc.id) {
      setDocViewerItem(updatedDoc);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!requireEdit('documents')) return;
    await StorageService.deleteDocument(id);
    const updated = await StorageService.getDocuments();
    setDocuments(updated);
    if (docViewerItem?.id === id) {
      setDocViewerItem(null);
    }
  };

  const handleBatchDeleteDocuments = async (ids: string[]) => {
    if (!requireEdit('documents')) return;
    await StorageService.deleteMultipleDocuments(ids);
    const updated = await StorageService.getDocuments();
    setDocuments(updated);
    if (docViewerItem && ids.includes(docViewerItem.id)) {
      setDocViewerItem(null);
    }
  };

  // Diese beiden Griffe wurden an Ansichten übergeben, die sie nie
  // entgegengenommen haben — sie konnten also nie ausgelöst werden.
  // Siehe git log -S handleBatchMoveDocuments.

  // Folder CRUD handlers
  const handleSaveFolder = async (folderData: DocumentFolder) => {
    if (!requireEdit('documents')) return;
    await StorageService.saveFolder(folderData);
    const updated = await StorageService.getFolders();
    setFolders(updated);
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!requireEdit('documents')) return;
    await StorageService.deleteFolder(folderId);
    const [updatedFolders, updatedDocs] = await Promise.all([
      StorageService.getFolders(),
      StorageService.getDocuments()
    ]);
    setFolders(updatedFolders);
    setDocuments(updatedDocs);
  };

  const handleBatchMoveToFolder = async (
    docIds: string[],
    targetFolderId: string | null,
    targetCategory?: DocumentCategory
  ) => {
    if (!requireEdit('documents')) return;
    await StorageService.batchMoveDocumentsToFolder(docIds, targetFolderId, targetCategory);
    const updated = await StorageService.getDocuments();
    setDocuments(updated);
    if (docViewerItem && docIds.includes(docViewerItem.id)) {
      const refreshed = updated.find(d => d.id === docViewerItem.id);
      if (refreshed) setDocViewerItem(refreshed);
    }
  };

  // Spenden & Zuwendungsbestätigungen (BMF) Handlers
  const nextDonationReceiptNumber = `ZB-${new Date().getFullYear()}-${String(donations.length + 1).padStart(3, '0')}`;

  const handleSaveDonationReceipt = async (
    receipt: DonationReceipt,
    options: {
      autoArchiveDoc: boolean;
      autoCreateTx: boolean;
      targetAccountId?: string;
    }
  ) => {
    if (!requireEdit('donations')) return;
    await StorageService.saveDonationReceipt(receipt, options);
    const [updatedDonations, updatedDocs, updatedTxs] = await Promise.all([
      StorageService.getDonations(),
      StorageService.getDocuments(),
      StorageService.getTransactions()
    ]);
    setDonations(updatedDonations);
    setDocuments(updatedDocs);
    setTransactions(updatedTxs);
    setDonationFormOpen(false);
    setEditingDonation(null);
  };

  const handleDeleteDonationReceipt = async (id: string) => {
    if (!requireEdit('donations')) return;
    await StorageService.deleteDonationReceipt(id);
    const [updatedDonations, updatedDocs] = await Promise.all([
      StorageService.getDonations(),
      StorageService.getDocuments()
    ]);
    setDonations(updatedDonations);
    setDocuments(updatedDocs);
  };

  const handleEditDonationReceipt = (receipt: DonationReceipt) => {
    if (!requireEdit('donations')) return;
    setEditingDonation(receipt);
    setDonationFormOpen(true);
  };

  const handleOpenCreateDonation = () => {
    if (!requireEdit('donations')) return;
    setEditingDonation(null);
    setDonationFormOpen(true);
  };

  // Invoicing CRUD Handlers (DIN 5008 & Blanko-Briefpapier)
  const nextInvoiceNumber = `RE-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`;

  const handleSaveInvoice = async (invoice: ClubInvoice, saveToDocuments: boolean = true) => {
    if (!requireEdit('invoices')) return;
    const toSave: ClubInvoice = { ...invoice };
    if (saveToDocuments) {
      try {
        const doc = await createDocumentFromInvoice(invoice, settings, invoiceTemplateSettings);
        await StorageService.saveDocument(doc);
        toSave.documentId = doc.id;
      } catch (docErr) {
        console.warn('Could not auto-archive invoice document:', docErr);
      }
    }
    await StorageService.saveInvoice(toSave);
    const [updatedInvoices, updatedDocs] = await Promise.all([
      StorageService.getInvoices(),
      StorageService.getDocuments()
    ]);
    setInvoices(updatedInvoices);
    setDocuments(updatedDocs);
    setInvoiceFormOpen(false);
    setEditingInvoice(null);
    setPrefillInvoiceRecipient(null);
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!requireEdit('invoices')) return;
    await StorageService.deleteInvoice(id);
    const updatedInvoices = await StorageService.getInvoices();
    setInvoices(updatedInvoices);
    if (detailsInvoice?.id === id) {
      setDetailsInvoice(null);
    }
  };

  const handleBulkDeleteInvoices = async (ids: string[]) => {
    if (!requireEdit('invoices')) return;
    for (const id of ids) {
      await StorageService.deleteInvoice(id);
    }
    const updatedInvoices = await StorageService.getInvoices();
    setInvoices(updatedInvoices);
  };


  const handleSaveInvoiceTemplate = async (newTemplate: InvoiceTemplateSettings) => {
    if (!requireEdit('invoices')) return;
    await StorageService.saveInvoiceTemplate(newTemplate);
    setInvoiceTemplateSettings(newTemplate);
    setInvoiceTemplateModalOpen(false);
  };

  const handleCreateInvoiceForContact = (contact: ClubContact) => {
    if (!requireEdit('invoices')) return;
    setEditingInvoice(null);
    setPrefillInvoiceRecipient({
      id: contact.id,
      name: contact.displayName,
      type: 'contact',
      company: contact.companyName,
      contactPerson: contact.contactPerson
        ? [contact.contactPerson.firstName, contact.contactPerson.lastName].filter(Boolean).join(' ')
        : undefined,
      email: contact.email,
      address: contact.address
        ? {
            street: contact.address.street,
            houseNumber: contact.address.houseNumber,
            zip: contact.address.zip,
            city: contact.address.city,
            country: contact.address.country
          }
        : undefined
    });
    setInvoiceFormOpen(true);
  };

  // Hier lag ein fertiger Griff, um aus der Mitgliederansicht heraus eine
  // Rechnung für ein Mitglied anzulegen — aufgerufen wurde er nie.
  // Siehe git log -S handleCreateInvoiceForMember.

  // Calendar Event Quick Action Handlers
  // --- Online-Aufnahmeanträge -------------------------------------------

  /**
   * Antrag annehmen. Verlangt Schreibrecht auf die Anträge UND auf die
   * Mitglieder, denn dabei entsteht ein neues Mitglied.
   *
   * Wirft bei fehlender Berechtigung eine Ausnahme statt still nichts zu
   * tun: Die Maske wartet auf das angelegte Mitglied und zeigt den Text
   * der Ausnahme als Fehlermeldung an.
   */
  const handleApproveApplication = async (
    appId: string,
    overrides: Partial<Member>,
    author: string
  ): Promise<{ member: Member; documentId: string }> => {
    if (!mayEdit('online_applications') || !mayEdit('members')) {
      throw new Error(
        'Keine Berechtigung: Anträge annehmen setzt das Recht voraus, Mitglieder anzulegen.'
      );
    }
    const res = await StorageService.approveOnlineApplication(
      appId,
      overrides,
      author || currentUser?.name || 'Vorstand'
    );
    await loadData();
    return res;
  };

  const handleRejectApplication = async (appId: string, reason: string, author: string) => {
    if (!requireEdit('online_applications')) return;
    await StorageService.rejectOnlineApplication(
      appId,
      reason,
      author || currentUser?.name || 'Vorstand'
    );
    await loadData();
  };

  const handleDeleteApplication = async (id: string) => {
    if (!requireEdit('online_applications')) return;
    await StorageService.deleteOnlineApplication(id);
    await loadData();
  };

  const handleSaveApplicationTemplate = async (newSettings: ApplicationTemplateSettings) => {
    if (!requireEdit('online_applications')) return;
    await StorageService.saveApplicationTemplateSettings(newSettings);
    await loadData();
  };

  const handleAddApplication = async (newApp: OnlineMembershipApplication) => {
    if (!requireEdit('online_applications')) return;
    await StorageService.saveOnlineApplication(newApp);
    await loadData();
  };

  const handleOpenCreateCalendarEvent = async () => {
    if (!requireEdit('calendar')) return;
    try {
      const cats = await StorageService.getCalendarCategories();
      setCalendarCategories(cats);
    } catch (e) {
      console.error('Error fetching calendar categories:', e);
    }
    setCalendarEventModalOpen(true);
  };

  const handleSaveCalendarEvent = async (eventData: CalendarEvent) => {
    if (!requireEdit('calendar')) return;
    await StorageService.saveCalendarEvent(eventData);
    setCalendarEventModalOpen(false);
    setCalendarRefreshKey(k => k + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 text-center max-w-sm w-full space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-lg font-bold text-white">VereinsManager</h2>
          <p className="text-xs text-slate-400">
            Lade lokale Vereinsdatenbank...
          </p>
        </div>
      </div>
    );
  }

  // Public Survey Participation Gate: Members can vote directly via link without registration/login
  if (publicSurveyParams) {
    return (
      <PublicSurveyView
        surveyId={publicSurveyParams.surveyId}
        token={publicSurveyParams.token}
        settings={settings}
        onClose={() => {
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', window.location.pathname);
          }
          setPublicSurveyParams(null);
        }}
      />
    );
  }

  // ---------------------------------------------------------------------
  // Öffentlicher Aufnahmeantrag
  //
  // Ein Interessent, der den Link von der Vereinswebsite aufruft, ist nicht
  // angemeldet und soll es auch nicht sein müssen. Deshalb steht dieser
  // Abschnitt VOR der Anmeldesperre. Bisher landete genau dieser Mensch im
  // Anmeldefenster — das Formular war zwar gebaut, aber unerreichbar.
  //
  // Angezeigt werden nur die Angaben, die die Datenbank für Besucher
  // freigibt: Vereinsname, Abteilungen, Beiträge. An die Mitgliederdaten oder
  // die Kontoverbindung kommt hier niemand.
  // ---------------------------------------------------------------------
  if (isPublicFormMode && !authSession.isAuthenticated) {
    const publicSettings: ClubSettings = publicClubInfo
      ? {
          ...settings,
          clubName: publicClubInfo.clubName || settings.clubName,
          associationNumber: publicClubInfo.associationNumber || settings.associationNumber,
          address: publicClubInfo.address || settings.address,
          creditorId: publicClubInfo.creditorId || settings.creditorId,
          departments: publicClubInfo.departments.length
            ? publicClubInfo.departments
            : settings.departments
        }
      : settings;

    const publicTemplate: ApplicationTemplateSettings = publicClubInfo
      ? { ...applicationSettings, ...publicClubInfo.template }
      : applicationSettings;

    return (
      <div className="min-h-screen bg-slate-900">
        <PublicApplicationForm
          settings={publicSettings}
          templateSettings={publicTemplate}
          isStandalone
          onSubmitApplication={async (app) => {
            // Im Cloud-Betrieb geht der Antrag unmittelbar an die
            // Vereinsdatenbank — bewusst ohne Zwischenspeicher im Browser
            // des Interessenten. Zwei Gründe: Seine Daten haben dort nichts
            // verloren, sobald er auf "Absenden" geklickt hat. Und käme die
            // Übertragung nicht durch, läge in seinem Browser eine Kopie,
            // von der der Verein nie erführe — der Antrag sähe abgeschickt
            // aus, wäre es aber nicht.
            if (isCloudModeActive()) {
              await CloudStorageService.saveOnlineApplication(app, { asVisitor: true });
              return;
            }
            // Ohne Cloud läuft das Formular auf dem Rechner des Vereins
            // selbst, etwa bei der Anmeldung im Vereinsheim. Dann ist die
            // lokale Ablage genau der richtige Ort.
            await StorageService.saveOnlineApplication(app);
          }}
        />
      </div>
    );
  }

  // Auth Gate: If user is not authenticated, show Login Screen
  if (!authSession.isAuthenticated) {
    return (
      <LoginScreen
        settings={settings}
        deploymentMode={deploymentMode}
        onLoginSuccess={(user) => {
          setActiveTab('dashboard');
          setAuthSession({ user, isAuthenticated: true, loginTime: new Date().toISOString() });
          loadData();
        }}
        onSettingsReload={(newSettings) => {
          if (newSettings) setSettings(newSettings);
        }}
      />
    );
  }

  const currentUser = authSession.user;

  const canEditFinances = mayEdit('finance');
  const canEditMembers = mayEdit('members');
  const canManageUsers = mayEdit('users');
  const isReadOnly = !canEditFinances && !canEditMembers;

  /** Zusatzklassen für einen gesperrten Navigationseintrag. */
  const navLockClass = (tab: ActiveTab): string =>
    mayAccess(tab) ? '' : ' opacity-40 cursor-not-allowed';

  const NAV_LOCK_TITLE = 'Ihre Rolle hat für diesen Bereich keine Berechtigung';

  /**
   * Bereichswechsel aus der Anwendung heraus (Kacheln, Querverweise).
   * Führt ins Leere, wenn die Berechtigung fehlt — sonst könnte ein
   * Verweis jemanden in einen Bereich befördern, den die Navigation
   * für ihn gesperrt hat.
   */
  const goToTab = (tab: ActiveTab) => {
    if (!mayAccess(tab)) return;
    setActiveTab(tab);
  };


  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar (Professional Polish Dark Navy/Slate-900) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden shadow-md border border-slate-700/50 shrink-0">
                <img
                  src={settings.clubLogoUrl || '/logo_transparent.png'}
                  alt={settings.clubName || 'VereinsManager Logo'}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    if (e.currentTarget.src !== window.location.origin + '/logo_transparent.png') {
                      e.currentTarget.src = '/logo_transparent.png';
                    }
                  }}
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold tracking-tight text-white leading-none">
                  VereinsManager
                </h1>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-medium truncate max-w-[140px]">
                  {settings.clubName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/50">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Lokale Instanz • Verschlüsselt</span>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {/* 1. Dashboard (Primary first menu item with interactive config button) */}
          <div
            onClick={() => {
              setActiveTab('dashboard');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer select-none ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-blue-400" />
              <span>Dashboard</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsDashboardConfigOpen(true);
              }}
              title="Dashboard-Kacheln und Layout anpassen"
              aria-label="Dashboard anpassen"
              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                activeTab === 'dashboard'
                  ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-2xs'
                  : 'bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-2.5 h-2.5" />
              <span>Anpassen</span>
            </button>
          </div>

          {/* 2. Mitglieder (Group with Sub-items) */}
          <div className="pt-2">
            <button
              id="nav-btn-members-group"
              type="button"
              onClick={() => setMembersMenuOpen(!membersMenuOpen)}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer select-none ${
                ['members', 'online_applications', 'member_analytics', 'member_surveys'].includes(activeTab)
                  ? 'text-blue-300 bg-slate-800/50 hover:bg-slate-800 hover:text-white'
                  : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
              }`}
              title={membersMenuOpen ? 'Mitglieder-Untermenü einklappen' : 'Mitglieder-Untermenü ausklappen'}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span>Mitglieder</span>
              </div>
              {membersMenuOpen ? (
                <ChevronDown className="w-3.5 h-3.5 transition-transform" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 transition-transform" />
              )}
            </button>

            {membersMenuOpen && (
              <div className="pl-2 pr-1 space-y-1 mt-1 border-l border-slate-800 ml-4">
                <button
                  type="button"
                  disabled={!mayAccess('members')}
                  title={mayAccess('members') ? undefined : NAV_LOCK_TITLE}
                  onClick={() => {
                    setActiveTab('members');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'members'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }${navLockClass('members')}`}
                >
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span>Mitgliederverwaltung</span>
                  {!mayAccess('members') && <Lock className="w-3 h-3 ml-auto shrink-0 text-slate-500" />}
                </button>

                <button
                  type="button"
                  disabled={!mayAccess('online_applications')}
                  title={mayAccess('online_applications') ? undefined : NAV_LOCK_TITLE}
                  onClick={() => {
                    setActiveTab('online_applications');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'online_applications'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }${navLockClass('online_applications')}`}
                >
                  <div className="flex items-center gap-2">
                    <FileSignature className="w-3.5 h-3.5 text-blue-400" />
                    <span>Mitgliedsanträge</span>
                  </div>
                  {onlineApplications.filter(a => a.status === 'pending').length > 0 ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500 text-white animate-pulse">
                      {onlineApplications.filter(a => a.status === 'pending').length} neu
                    </span>
                  ) : (
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
                        activeTab === 'online_applications'
                          ? 'bg-blue-500/80 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {onlineApplications.length}
                    </span>
                  )}
                  {!mayAccess('online_applications') && <Lock className="w-3 h-3 ml-auto shrink-0 text-slate-500" />}
                </button>

                <button
                  type="button"
                  disabled={!mayAccess('member_analytics')}
                  title={mayAccess('member_analytics') ? undefined : NAV_LOCK_TITLE}
                  onClick={() => {
                    setActiveTab('member_analytics');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'member_analytics'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }${navLockClass('member_analytics')}`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Mitglieder-Statistiken</span>
                  {!mayAccess('member_analytics') && <Lock className="w-3 h-3 ml-auto shrink-0 text-slate-500" />}
                </button>

                <button
                  type="button"
                  disabled={!mayAccess('member_surveys')}
                  title={mayAccess('member_surveys') ? undefined : NAV_LOCK_TITLE}
                  id="nav-btn-member-surveys"
                  onClick={() => {
                    setActiveTab('member_surveys');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'member_surveys'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }${navLockClass('member_surveys')}`}
                >
                  <Vote className="w-3.5 h-3.5 text-blue-400" />
                  <span>Mitgliederbefragung</span>
                  {!mayAccess('member_surveys') && <Lock className="w-3 h-3 ml-auto shrink-0 text-slate-500" />}
                </button>
              </div>
            )}
          </div>

          {/* 3. Finanzen (Group with Sub-items: Buchungen, Beitragslauf, EÜR / GuV, Auswertungen) */}
          <div className="pt-2">
            <button
              id="nav-btn-finance-group"
              type="button"
              onClick={() => setFinanceMenuOpen(!financeMenuOpen)}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer select-none ${
                ['finance', 'sepa', 'guv', 'invoices', 'donations', 'finance_analytics'].includes(activeTab)
                  ? 'text-emerald-300 bg-slate-800/50 hover:bg-slate-800 hover:text-white'
                  : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
              }`}
              title={financeMenuOpen ? 'Finanzen-Untermenü einklappen' : 'Finanzen-Untermenü ausklappen'}
            >
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Finanzen</span>
              </div>
              {financeMenuOpen ? (
                <ChevronDown className="w-3.5 h-3.5 transition-transform" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 transition-transform" />
              )}
            </button>

            {financeMenuOpen && (
              <div className="pl-2 pr-1 space-y-1 mt-1 border-l border-slate-800 ml-4">
                {/* 3a. Buchungen & Konten */}
                <button
                  type="button"
                  disabled={!mayAccess('finance')}
                  title={mayAccess('finance') ? undefined : NAV_LOCK_TITLE}
                  onClick={() => {
                    setActiveTab('finance');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'finance'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }${navLockClass('finance')}`}
                >
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Buchungen & Journal</span>
                  {!mayAccess('finance') && <Lock className="w-3 h-3 ml-auto shrink-0 text-slate-500" />}
                </button>

                {/* 3b. Beitragslauf (SEPA) */}
                <button
                  type="button"
                  disabled={!mayAccess('sepa')}
                  title={mayAccess('sepa') ? undefined : NAV_LOCK_TITLE}
                  onClick={() => {
                    setActiveTab('sepa');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'sepa'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }${navLockClass('sepa')}`}
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Beitragslauf</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      activeTab === 'sepa'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40'
                    }`}
                  >
                    SEPA
                  </span>
                  {!mayAccess('sepa') && <Lock className="w-3 h-3 ml-auto shrink-0 text-slate-500" />}
                </button>

                {/* 3c. EÜR / GuV */}
                <button
                  type="button"
                  disabled={!mayAccess('guv')}
                  title={mayAccess('guv') ? undefined : NAV_LOCK_TITLE}
                  onClick={() => {
                    setActiveTab('guv');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'guv'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }${navLockClass('guv')}`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>EÜR / GuV</span>
                  {!mayAccess('guv') && <Lock className="w-3 h-3 ml-auto shrink-0 text-slate-500" />}
                </button>

                {/* 3d. Rechnungen & Vorlagen */}
                <button
                  id="nav-btn-invoices"
                  type="button"
                  disabled={!mayAccess('invoices')}
                  title={mayAccess('invoices') ? undefined : NAV_LOCK_TITLE}
                  onClick={() => {
                    setActiveTab('invoices');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeTab === 'invoices'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }${navLockClass('invoices')}`}
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Rechnungen</span>
                  {!mayAccess('invoices') && <Lock className="w-3 h-3 ml-auto shrink-0 text-slate-500" />}
                </button>

                {/* 3e. Geld- & Sachzuwendungen (BMF Muster) */}
                <button
                  id="nav-btn-donations"
                  type="button"
                  disabled={!mayAccess('donations')}
                  title={mayAccess('donations') ? undefined : NAV_LOCK_TITLE}
                  onClick={() => {
                    setActiveTab('donations');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'donations'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }${navLockClass('donations')}`}
                >
                  <HeartHandshake className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Spenden</span>
                  {!mayAccess('donations') && <Lock className="w-3 h-3 ml-auto shrink-0 text-slate-500" />}
                </button>

                {/* 3e. Finanz-Auswertungen */}
                <button
                  type="button"
                  disabled={!mayAccess('finance_analytics')}
                  title={mayAccess('finance_analytics') ? undefined : NAV_LOCK_TITLE}
                  onClick={() => {
                    setActiveTab('finance_analytics');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'finance_analytics'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }${navLockClass('finance_analytics')}`}
                >
                  <PieChart className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Finanz-Auswertungen</span>
                  {!mayAccess('finance_analytics') && <Lock className="w-3 h-3 ml-auto shrink-0 text-slate-500" />}
                </button>
              </div>
            )}
          </div>

          {/* Kontakte (eigenständiger Menüpunkt zwischen Finanzen und Kalender) */}
          <div className="pt-2">
            <button
              id="nav-btn-contacts"
              type="button"
              disabled={!mayAccess('contacts')}
              title={mayAccess('contacts') ? undefined : NAV_LOCK_TITLE}
              onClick={() => {
                setActiveTab('contacts');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'contacts'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }${navLockClass('contacts')}`}
            >
              <div className="flex items-center gap-2">
                <Contact className={`w-4 h-4 ${activeTab === 'contacts' ? 'text-white' : 'text-cyan-400'}`} />
                <span>Kontakte</span>
              </div>
              {!mayAccess('contacts') && <Lock className="w-3 h-3 ml-auto shrink-0 text-slate-500" />}
            </button>
          </div>

          {/* 4. Kalender */}
          <div className="pt-2">
            <button
              id="nav-btn-calendar"
              type="button"
              disabled={!mayAccess('calendar')}
              title={mayAccess('calendar') ? undefined : NAV_LOCK_TITLE}
              onClick={() => {
                setActiveTab('calendar');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }${navLockClass('calendar')}`}
            >
              <div className="flex items-center gap-2">
                <CalendarDays className={`w-4 h-4 ${activeTab === 'calendar' ? 'text-white' : 'text-indigo-400'}`} />
                <span>Kalender</span>
              </div>
              {!mayAccess('calendar') && <Lock className="w-3 h-3 ml-auto shrink-0 text-slate-500" />}
            </button>
          </div>

          {/* Sitzungen & Protokolldienst */}
          <div className="pt-2">
            <button
              id="nav-btn-meetings"
              type="button"
              disabled={!mayAccess('meetings')}
              title={mayAccess('meetings') ? undefined : NAV_LOCK_TITLE}
              onClick={() => {
                setActiveTab('meetings');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'meetings'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }${navLockClass('meetings')}`}
            >
              <div className="flex items-center gap-2">
                <ScrollText className={`w-4 h-4 ${activeTab === 'meetings' ? 'text-white' : 'text-rose-400'}`} />
                <span>Sitzungen</span>
              </div>
              {!mayAccess('meetings') && <Lock className="w-3 h-3 ml-auto shrink-0 text-slate-500" />}
            </button>
          </div>

          {/* 5. Inventar */}
          <div className="pt-2">
            <button
              type="button"
              disabled={!mayAccess('inventory')}
              title={mayAccess('inventory') ? undefined : NAV_LOCK_TITLE}
              onClick={() => {
                setActiveTab('inventory');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'inventory'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }${navLockClass('inventory')}`}
            >
              <Package className="w-4 h-4 text-purple-400" />
              <span>Inventar</span>
              {!mayAccess('inventory') && <Lock className="w-3 h-3 ml-auto shrink-0 text-slate-500" />}
            </button>
          </div>

          {/* 6. Dokumente */}
          <div className="pt-2">
            <button
              id="nav-btn-documents"
              type="button"
              disabled={!mayAccess('documents')}
              title={mayAccess('documents') ? undefined : NAV_LOCK_TITLE}
              onClick={() => {
                setActiveTab('documents');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'documents'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }${navLockClass('documents')}`}
            >
              <FolderArchive className="w-4 h-4 text-amber-400" />
              <span>Dokumente</span>
              {!mayAccess('documents') && <Lock className="w-3 h-3 ml-auto shrink-0 text-slate-500" />}
            </button>
          </div>
        </nav>

        {/* Sidebar Footer (Settings button & App Version) */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          {/* Settings Nav Button (Dedicated Full Page) */}
          <button
            id="nav-btn-settings"
            type="button"
            onClick={() => {
              setSettingsActiveTab('general');
              goToTab('settings');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-300 bg-slate-800/90 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-white' : 'text-slate-400'}`} />
              <span className="font-bold text-xs">Einstellungen</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              activeTab === 'settings' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'
            }`}>
              System
            </span>
          </button>

          {/* App Version Tile & 1-Klick Update Popover */}
          <AppVersionBadge
            currentMode={deploymentMode}
          />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Demo Mode Sandbox Notice */}
        {AuthService.isDemoMode() && (
          <div className="bg-amber-500/10 border-b border-amber-300/50 dark:border-amber-700/50 px-4 py-2 flex items-center justify-between text-xs text-amber-950 dark:text-amber-200 font-medium shrink-0">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="font-bold text-amber-900 dark:text-amber-300">Demo-Modus aktiv:</span>
              <span className="hidden md:inline text-amber-800 dark:text-amber-200">
                Fiktive Beispieldaten (TSV Musterstadt 1890 e.V.). Ihre echten Vereinsdaten sind strikt getrennt & geschützt.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm('Demo-Daten wirklich auf die Beispieldaten zurücksetzen?')) {
                    await StorageService.resetDemoData();
                    await loadData();
                  }
                }}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-lg text-2xs font-semibold transition-colors cursor-pointer"
                title="Demo-Beispieldaten auf Standard zurücksetzen"
              >
                Musterdaten resetten
              </button>
              <button
                type="button"
                onClick={() => AuthService.logout()}
                className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-2xs font-bold transition-colors cursor-pointer"
              >
                Demo beenden
              </button>
            </div>
          </div>
        )}

        {/* Top Header Bar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between shrink-0 z-20 gap-3">
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg lg:hidden"
              aria-label="Menü öffnen"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile Header Logo */}
            <div className="w-8 h-8 rounded-lg bg-white p-0.5 flex items-center justify-center overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700 shrink-0 lg:hidden">
              <img
                src={settings.clubLogoUrl || '/logo_transparent.png'}
                alt={settings.clubName || 'VereinsManager Logo'}
                className="w-full h-full object-contain"
                onError={(e) => {
                  if (e.currentTarget.src !== window.location.origin + '/logo_transparent.png') {
                    e.currentTarget.src = '/logo_transparent.png';
                  }
                }}
              />
            </div>

            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white leading-tight truncate">
                {activeTab === 'dashboard' && 'Vereins-Dashboard'}
                {activeTab === 'members' && 'Mitgliederverwaltung'}
                {activeTab === 'online_applications' && 'Mitgliedsanträge & Digitales Aufnahmewesen'}
                {activeTab === 'member_analytics' && 'Mitglieder-Statistiken & Demografie'}
                {activeTab === 'member_surveys' && 'Mitgliederbefragung & Meinungsbilder'}
                {activeTab === 'sepa' && 'Beitragslauf (SEPA-Lastschriften)'}
                {activeTab === 'finance' && 'Finanz- & Kassenverwaltung'}
                {activeTab === 'guv' && 'Einnahmen-Überschuss-Rechnung (EÜR / GuV)'}
                {activeTab === 'invoices' && 'Rechnungen & Vorlagen (DIN 5008)'}
                {activeTab === 'finance_analytics' && 'Finanzanalysen & Cashflow'}
                {activeTab === 'donations' && 'Geld- & Sachzuwendungen (BMF-Zuwendungsbestätigungen)'}
                {activeTab === 'contacts' && 'Kontaktverwaltung (Geschäftspartner, Lieferanten, Sponsoren & Spender)'}
                {activeTab === 'calendar' && 'Kalender & Termine'}
                {activeTab === 'meetings' && 'Sitzungs- & Protokolldienst'}
                {activeTab === 'inventory' && 'Inventar- & Materialverwaltung'}
                {activeTab === 'documents' && 'Dokumentenverwaltung & Archiv'}
                {activeTab === 'settings' && 'System- & Vereinseinstellungen'}
              </h2>
              <p className="text-2xs text-slate-400 dark:text-slate-500 font-medium hidden sm:block truncate">
                {settings.clubName}
              </p>
            </div>
          </div>

          {/* Right Header User & Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Read-Only Badge for Auditor */}
            {isReadOnly && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-full text-xs font-medium">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Kassenprüfer (Nur Leserecht)</span>
              </div>
            )}

            {/* User Profile & Session Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-all cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[120px] leading-tight">
                    {currentUser?.name || 'Benutzer'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${canManageUsers ? 'bg-rose-500' : canEditFinances ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                    <span>{currentUser?.customRoleName || (canManageUsers ? 'Administrator' : 'Benutzer')}</span>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setUserDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-40 space-y-1 animate-in fade-in zoom-in-95 duration-100 text-xs">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700 mb-2">
                      <div className="font-bold text-slate-900 dark:text-white truncate">{currentUser?.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">Login: {currentUser?.username}</div>
                      <div className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-semibold border bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                        {currentUser?.customRoleName || (canManageUsers ? 'Administrator' : 'Benutzer')}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        setSettingsActiveTab('general');
                        goToTab('settings');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-left transition-colors cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Systemeinstellungen</span>
                    </button>

                    {canManageUsers && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setSettingsActiveTab('users');
                          goToTab('settings');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-left transition-colors cursor-pointer"
                      >
                        <UserCog className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Benutzerverwaltung & Rechte</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        AuthService.lockSession();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-left transition-colors"
                    >
                      <Lock className="w-4 h-4 text-amber-600" />
                      <span>Sitzung jetzt sperren</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        AuthService.logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-left transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-rose-600" />
                      <span>Abmelden / Benutzer wechseln</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Quick Lock Button */}
            <button
              type="button"
              onClick={() => AuthService.lockSession()}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors border border-transparent hover:border-slate-200"
              title="Sitzung sofort sperren"
            >
              <Lock className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </header>

        {/* Scrollable View Area */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Tab 0: Dashboard */}
            {activeTab === 'dashboard' && (
              <DashboardView
                members={members}
                transactions={transactions}
                accounts={accounts}
                inventory={inventory}
                documents={documents}
                donations={donations}
                applications={onlineApplications}
                invoices={invoices}
                contacts={contacts}
                meetings={meetings}
                settings={settings}
                calendarRefreshKey={calendarRefreshKey}
                dashboardConfig={dashboardConfig}
                onUpdateDashboardConfig={(newConfig) => {
                  setDashboardConfig(newConfig);
                  StorageService.saveDashboardConfig(newConfig);
                }}
                onOpenDashboardConfigModal={() => setIsDashboardConfigOpen(true)}
                onNavigate={(tab) => goToTab(tab)}
                onOpenCreateMember={() => {
                  setEditingMember(null);
                  setMemberFormOpen(true);
                }}
                onOpenCreateTx={() => {
                  setEditingTx(null);
                  setTxFormOpen(true);
                }}
                onOpenCreateInvoice={() => {
                  setEditingInvoice(null);
                  setPrefillInvoiceRecipient(null);
                  setInvoiceFormOpen(true);
                }}
                onOpenCreateContact={() => {
                  setEditingContact(null);
                  setInitialContactFormName('');
                  setInitialContactFormType(undefined);
                  setContactFormOpen(true);
                }}
                onOpenCreateMeeting={() => {
                  setEditingMeeting(null);
                  setMeetingFormOpen(true);
                }}
                onOpenCreateEvent={handleOpenCreateCalendarEvent}
                onOpenCreateInventory={() => {
                  setEditingInventoryItem(null);
                  setInventoryFormOpen(true);
                }}
                onOpenNewDocument={() => setNewDocChoiceOpen(true)}
                userPermissions={userPermissions}
              />
            )}

            {/* Tab 1: Members Management */}
            {activeTab === 'members' && (
              <MembersView
                members={members}
                settings={settings}
                onOpenCreate={() => {
                  setEditingMember(null);
                  setMemberFormOpen(true);
                }}
                onOpenEdit={(member) => {
                  setEditingMember(member);
                  setMemberFormOpen(true);
                }}
                onOpenDetails={(member) => setDetailsMember(member)}
                onDeleteMember={handleDeleteMember}
                onBulkUpdateMembers={handleBulkUpdateMembers}
                onBulkDeleteMembers={handleBulkDeleteMembers}
                onOpenImport={() => setMemberImportOpen(true)}
                canEdit={mayEdit('members')}
                onLocked={() => requireEdit('members')}
              />
            )}

            {/* Tab: Online Membership Applications */}
            {activeTab === 'online_applications' && (
              <OnlineApplicationsView
                applications={onlineApplications}
                members={members}
                settings={settings}
                templateSettings={applicationSettings}
                currentUser={currentUser?.name || 'Vorstand'}
                onApproveApplication={handleApproveApplication}
                onRejectApplication={handleRejectApplication}
                onDeleteApplication={handleDeleteApplication}
                onSaveTemplateSettings={handleSaveApplicationTemplate}
                onSubmitNewApplication={handleAddApplication}
                canEdit={mayEdit('online_applications')}
                onLocked={() => requireEdit('online_applications')}
                />
            )}

            {/* Tab 2: Member Analytics */}
            {activeTab === 'member_analytics' && (
              <MemberAnalyticsView members={members} settings={settings} />
            )}

            {/* Tab: Member Surveys & Feedback */}
            {activeTab === 'member_surveys' && (
              <MemberSurveysView
                settings={settings}
                members={members}
                deploymentMode={deploymentMode}
                onNavigateToSettings={() => {
                  setSettingsActiveTab('deployment');
                  goToTab('settings');
                }}
                canEdit={mayEdit('member_surveys')}
                onLocked={() => requireEdit('member_surveys')}
                />
            )}

            {/* Tab: SEPA Direct Debit & Contribution Run */}
            {activeTab === 'sepa' && (
              <SepaRunView
                members={members}
                settings={settings}
                accounts={accounts}
                onOpenSettings={() => goToTab('settings')}
                onRefreshData={loadData}
                canEdit={mayEdit('sepa')}
                onLocked={() => requireEdit('sepa')}
                />
            )}

            {/* Tab 3: Finance Management */}
            {activeTab === 'finance' && (
              <FinanceView
                transactions={transactions}
                accounts={accounts}
                settings={settings}
                contacts={contacts}
                onOpenCreateContactFromTx={(partnerName, isIncome) =>
                  handleQuickCreateContact(partnerName, isIncome ? 'sponsor' : 'supplier')
                }
                onOpenCreateTx={() => {
                  setEditingTx(null);
                  setTxFormOpen(true);
                }}
                onOpenEditTx={(tx) => {
                  setEditingTx(tx);
                  setTxFormOpen(true);
                }}
                onDeleteTx={handleDeleteTransaction}
                onBulkUpdateTransactions={handleBulkUpdateTransactions}
                onBulkDeleteTransactions={handleBulkDeleteTransactions}
                onOpenBankImport={() => setBankImportOpen(true)}
                onOpenTransactionImport={() => setTransactionImportOpen(true)}
                onOpenReceiptScanner={() => {
                  setScannerTargetTx(null);
                  setReceiptScannerOpen(true);
                }}
                onQuickScanReceipt={handleQuickScanReceipt}
                onOpenAccountManage={() => setAccountManageOpen(true)}
                onOpenReceiptViewer={(receipt, docNum, text) => {
                  setActiveReceipt({ receipt, docNum, text });
                }}
                onReorderAccounts={handleReorderAccounts}
                canEdit={mayEdit('finance')}
                onLocked={() => requireEdit('finance')}
                />
            )}

            {/* Tab 4: GuV / EÜR Report (4 Tax Spheres) */}
            {activeTab === 'guv' && (
              <GuvReportView
                transactions={transactions}
                settings={settings}
              />
            )}

            {/* Tab: Invoices Management & Blanko-Briefpapier (DIN 5008) */}
            {activeTab === 'invoices' && (
              <InvoicesView
                invoices={invoices}
                clubSettings={settings}
                templateSettings={invoiceTemplateSettings}
                onOpenCreate={() => {
                  setEditingInvoice(null);
                  setPrefillInvoiceRecipient(null);
                  setInvoiceFormOpen(true);
                }}
                onOpenEdit={(inv) => {
                  setEditingInvoice(inv);
                  setInvoiceFormOpen(true);
                }}
                onOpenDetails={(inv) => {
                  setDetailsInvoice(inv);
                }}
                onDeleteInvoice={handleDeleteInvoice}
                onBulkDeleteInvoices={handleBulkDeleteInvoices}
                onOpenTemplateConfig={() => setInvoiceTemplateModalOpen(true)}
                canEdit={mayEdit('invoices')}
                onLocked={() => requireEdit('invoices')}
                />
            )}

            {/* Tab 5: Finance Analytics */}
            {activeTab === 'finance_analytics' && (
              <FinanceAnalyticsView
                transactions={transactions}
                accounts={accounts}
              />
            )}

            {/* Tab: Spenden & Zuwendungsbestätigungen (BMF Muster 1 & 2) */}
            {activeTab === 'donations' && (
              <DonationsView
                donations={donations}
                settings={settings}
                documents={documents}
                onOpenCreateModal={handleOpenCreateDonation}
                onEditReceipt={handleEditDonationReceipt}
                onDeleteReceipt={handleDeleteDonationReceipt}
                onViewDocument={(doc) => setDocViewerItem(doc)}
                canEdit={mayEdit('donations')}
                onLocked={() => requireEdit('donations')}
                />
            )}

            {/* Tab: Contacts Management */}
            {activeTab === 'contacts' && (
              <ContactsView
                contacts={contacts}
                clubName={settings.clubName}
                onOpenCreate={() => {
                  setEditingContact(null);
                  setInitialContactFormName('');
                  setInitialContactFormType(undefined);
                  setContactFormOpen(true);
                }}
                onOpenEdit={c => {
                  setEditingContact(c);
                  setContactFormOpen(true);
                }}
                onOpenDetails={c => setDetailsContact(c)}
                onDeleteContact={handleDeleteContact}
                onBulkDeleteContacts={handleBulkDeleteContacts}
                onCreateBookingForContact={c => {
                  setEditingTx(null);
                  setInitialBookingPartner(c.displayName);
                  setTxFormOpen(true);
                }}
                onCreateInvoiceForContact={handleCreateInvoiceForContact}
                onOpenImport={() => setContactImportOpen(true)}
                canEdit={mayEdit('contacts')}
                onLocked={() => requireEdit('contacts')}
                />
            )}

            {/* Tab 6: Inventory Management */}
            {activeTab === 'inventory' && (
              <InventoryView
                inventory={inventory}
                departments={settings.departments}
                settings={settings}
                members={members}
                onOpenCreate={() => {
                  setEditingInventoryItem(null);
                  setInventoryFormOpen(true);
                }}
                onOpenEdit={(item) => {
                  setEditingInventoryItem(item);
                  setInventoryFormOpen(true);
                }}
                onDeleteItem={handleDeleteInventoryItem}
                onBulkUpdateItems={handleBulkUpdateInventoryItems}
                onBulkDeleteItems={handleBulkDeleteInventoryItems}
                canEdit={mayEdit('inventory')}
                onLocked={() => requireEdit('inventory')}
                />
            )}

            {/* Tab: Calendar & Events */}
            {activeTab === 'calendar' && (
              <CalendarView
                members={members}
                settings={settings}
                canEdit={mayEdit('calendar')}
                onLocked={() => requireEdit('calendar')}
                />
            )}

            {/* Tab: Meetings & Protocol Management */}
            {activeTab === 'meetings' && (
              <MeetingsView
                meetings={meetings}
                members={members}
                clubSettings={settings}
                templateSettings={meetingTemplateSettings}
                onSaveMeeting={handleSaveMeeting}
                onDeleteMeeting={handleDeleteMeeting}
                onSaveTemplate={handleSaveMeetingTemplate}
                canEdit={mayEdit('meetings')}
                onLocked={() => requireEdit('meetings')}
                />
            )}

            {/* Tab 7: Documents Management */}
            {activeTab === 'documents' && (
              <DocumentsView
                documents={documents}
                folders={folders}
                onOpenUpload={(cat, folderId) => {
                  setDocUploadCategory(cat);
                  setDocUploadFolderId(folderId || null);
                  setDocUploadOpen(true);
                }}
                onOpenScanner={() => setDocScannerOpen(true)}
                onOpenViewer={(doc) => setDocViewerItem(doc)}
                onOpenEdit={(doc) => setDocEditItem(doc)}
                onDeleteDoc={handleDeleteDocument}
                onBatchDelete={handleBatchDeleteDocuments}
                onSaveFolder={handleSaveFolder}
                onDeleteFolder={handleDeleteFolder}
                onBatchMoveToFolder={handleBatchMoveToFolder}
                canEdit={mayEdit('documents')}
                onLocked={() => requireEdit('documents')}
                />
            )}

            {/* Tab 8: Dedicated Settings & Administration Page */}
            {activeTab === 'settings' && (
              <SettingsView
                settings={settings}
                onSaveSettings={handleSaveSettings}
                onDataReload={loadData}
                onOpenUserManage={() => setUserManageOpen(true)}
                currentTheme={theme}
                onThemeChange={(newTheme) => setTheme(newTheme)}
                deploymentMode={deploymentMode}
                onDeploymentModeChange={(newMode) => setDeploymentMode(newMode)}
                initialTab={settingsActiveTab}
                onTabChange={(tab) => setSettingsActiveTab(tab)}
                canEdit={mayEdit('settings')}
                onLocked={() => requireEdit('settings')}
                canManageUsers={mayEdit('users')}
                currentCloudUserId={authSession.loginMethod === 'supabase' ? currentUser?.id : undefined}
                onUsersLocked={() => requireEdit('users')}
                />
            )}
          </div>
        </div>
      </main>

      {/* 5. Modals & Drawers */}

      {/* New Document Choice Dialog (Upload vs Scan) */}
      {newDocChoiceOpen && (
        <NewDocumentChoiceModal
          isOpen={newDocChoiceOpen}
          onSelectUpload={() => {
            setNewDocChoiceOpen(false);
            setDocUploadCategory(undefined);
            setDocUploadFolderId(null);
            setDocUploadOpen(true);
          }}
          onSelectScan={() => {
            setNewDocChoiceOpen(false);
            setDocScannerOpen(true);
          }}
          onClose={() => setNewDocChoiceOpen(false)}
        />
      )}

      {/* Document Upload Modal */}
      {docUploadOpen && (
        <DocumentUploadModal
          initialCategory={docUploadCategory}
          initialFolderId={docUploadFolderId}
          folders={folders}
          members={members}
          transactions={transactions}
          onSaveDocuments={handleSaveBatchDocuments}
          onClose={() => {
            setDocUploadOpen(false);
            setDocUploadCategory(undefined);
            setDocUploadFolderId(null);
          }}
        />
      )}

      {/* Document Edit Metadata Modal */}
      {docEditItem && (
        <DocumentEditModal
          document={docEditItem}
          folders={folders}
          members={members}
          transactions={transactions}
          onSave={handleUpdateDocument}
          onClose={() => setDocEditItem(null)}
        />
      )}

      {/* Document Fullscreen Viewer Lightbox */}
      {docViewerItem && (
        <DocumentViewerModal
          document={docViewerItem}
          onClose={() => setDocViewerItem(null)}
          onEdit={() => {
            const item = docViewerItem;
            setDocViewerItem(null);
            setDocEditItem(item);
          }}
        />
      )}

      {/* Camera Document Scanner Modal */}
      {docScannerOpen && (
        <ReceiptCameraScannerModal
          prefillDocumentNumber={`DOK-${new Date().getFullYear()}-${String(documents.length + 1).padStart(3, '0')}`}
          existingTransactions={transactions}
          accounts={accounts}
          settings={settings}
          onSaveAsDocument={(savedDoc) => {
            handleSaveSingleDocument(savedDoc);
            setDocScannerOpen(false);
          }}
          onCreateTransactionWithReceipt={handleScannerCreateTransactionWithReceipt}
          onClose={() => setDocScannerOpen(false)}
        />
      )}

      {/* Member Create/Edit Modal */}
      {memberFormOpen && (
        <MemberFormModal
          member={editingMember}
          departments={settings.departments}
          nextMemberNumber={nextMemberNumber}
          onSave={handleSaveMember}
          onClose={() => {
            setMemberFormOpen(false);
            setEditingMember(null);
          }}
        />
      )}

      {/* Inventory Create/Edit Modal */}
      {inventoryFormOpen && (
        <InventoryFormModal
          item={editingInventoryItem}
          departments={settings.departments}
          onSave={handleSaveInventoryItem}
          onClose={() => {
            setInventoryFormOpen(false);
            setEditingInventoryItem(null);
          }}
        />
      )}

      {/* Member CSV & Google Sheets Import Modal */}
      {memberImportOpen && (
        <MemberImportModal
          existingMembers={members}
          settings={settings}
          onImport={handleBatchMemberImport}
          onClose={() => setMemberImportOpen(false)}
        />
      )}

      {/* Member Details & Audit Drawer */}
      {detailsMember && (
        <MemberDetailsDrawer
          member={detailsMember}
          settings={settings}
          inventory={inventory}
          allMembers={members}
          onClose={() => setDetailsMember(null)}
          onDelete={handleDeleteMember}
          onSaveMember={handleSaveMember}
          onEdit={(m) => {
            setDetailsMember(null);
            setEditingMember(m);
            setMemberFormOpen(true);
          }}
          canEdit={mayEdit('members')}
                onLocked={() => requireEdit('members')}
                />
      )}

      {/* Transaction Create/Edit Modal */}
      {txFormOpen && (
        <TransactionFormModal
          transaction={editingTx}
          accounts={accounts}
          nextDocNumber={nextDocNumber}
          contacts={contacts}
          members={members}
          initialPartner={initialBookingPartner}
          onQuickCreateContact={handleQuickCreateContact}
          onSave={handleSaveTransaction}
          onClose={() => {
            setTxFormOpen(false);
            setEditingTx(null);
            setInitialBookingPartner('');
          }}
        />
      )}

      {/* Contact Create/Edit Modal */}
      {contactFormOpen && (
        <ContactFormModal
          isOpen={contactFormOpen}
          contact={editingContact}
          nextContactNumber={nextContactNumber}
          initialName={initialContactFormName}
          initialType={initialContactFormType}
          onSave={handleSaveContact}
          onClose={() => {
            setContactFormOpen(false);
            setEditingContact(null);
            setInitialContactFormName('');
            setInitialContactFormType(undefined);
          }}
        />
      )}

      {/* Contact Details Modal */}
      {detailsContact && (
        <ContactDetailsModal
          isOpen={true}
          contact={detailsContact}
          transactions={transactions}
          onClose={() => setDetailsContact(null)}
          onEdit={(c) => {
            setDetailsContact(null);
            setEditingContact(c);
            setContactFormOpen(true);
          }}
          onDelete={handleDeleteContact}
          onCreateBookingForContact={(c) => {
            setDetailsContact(null);
            setEditingTx(null);
            setInitialBookingPartner(c.displayName);
            setTxFormOpen(true);
          }}
        />
      )}

      {/* Contact Import Modal (CSV & Sheets) */}
      {contactImportOpen && (
        <ContactImportModal
          existingContacts={contacts}
          onImport={handleBatchImportContacts}
          onClose={() => setContactImportOpen(false)}
        />
      )}

      {/* Donation Receipt (BMF Geld- & Sachzuwendung) Modal */}
      {donationFormOpen && (
        <DonationFormModal
          isOpen={donationFormOpen}
          editingReceipt={editingDonation}
          members={members}
          accounts={accounts}
          settings={settings}
          nextReceiptNumber={nextDonationReceiptNumber}
          onSave={handleSaveDonationReceipt}
          onClose={() => {
            setDonationFormOpen(false);
            setEditingDonation(null);
          }}
        />
      )}

      {/* Bank Statement CSV Importer Modal */}
      {bankImportOpen && (
        <BankImportModal
          accounts={accounts}
          onImport={handleBankImport}
          onClose={() => setBankImportOpen(false)}
        />
      )}

      {/* Excel / Google Sheets Transaction Importer Modal */}
      {transactionImportOpen && (
        <TransactionImportModal
          existingTransactions={transactions}
          accounts={accounts}
          settings={settings}
          onImport={handleBatchTransactionImport}
          onClose={() => setTransactionImportOpen(false)}
        />
      )}

      {/* Account / Cash Register Management Modal */}
      {accountManageOpen && (
        <AccountManageModal
          accounts={accounts}
          onSaveAccount={handleSaveAccount}
          onDeleteAccount={handleDeleteAccount}
          onClose={() => setAccountManageOpen(false)}
        />
      )}

      {/* Receipt Viewer (Lightbox / PDF & Image Viewer) */}
      {activeReceipt && (
        <ReceiptViewerModal
          receipt={activeReceipt.receipt}
          documentNumber={activeReceipt.docNum}
          bookingText={activeReceipt.text}
          onClose={() => setActiveReceipt(null)}
        />
      )}

      {/* Camera Receipt Scanner & Digitization Modal */}
      {receiptScannerOpen && (
        <ReceiptCameraScannerModal
          prefillDocumentNumber={scannerTargetTx?.documentNumber || nextDocNumber}
          prefillPartner={scannerTargetTx?.partner || ''}
          prefillBookingText={scannerTargetTx?.bookingText || ''}
          existingTransactions={transactions}
          accounts={accounts}
          settings={settings}
          onAttachReceipt={
            scannerTargetTx
              ? (receipt) => handleScannerLinkToTransaction(scannerTargetTx.id, receipt)
              : undefined
          }
          onLinkToTransaction={handleScannerLinkToTransaction}
          onCreateTransactionWithReceipt={handleScannerCreateTransactionWithReceipt}
          onClose={() => {
            setReceiptScannerOpen(false);
            setScannerTargetTx(null);
          }}
        />
      )}

      {/* Invoice Form Modal (Erstellung & Bearbeitung) */}
      {invoiceFormOpen && (
        <InvoiceFormModal
          isOpen={invoiceFormOpen}
          onClose={() => {
            setInvoiceFormOpen(false);
            setEditingInvoice(null);
            setPrefillInvoiceRecipient(null);
          }}
          invoice={editingInvoice}
          members={members}
          contacts={contacts}
          templateSettings={invoiceTemplateSettings}
          nextInvoiceNumber={nextInvoiceNumber}
          prefillRecipient={prefillInvoiceRecipient}
          onSave={handleSaveInvoice}
          onPreviewPdf={(inv) => downloadInvoicePdf(inv, settings, invoiceTemplateSettings)}
        />
      )}

      {/* Invoice Details Modal */}
      {detailsInvoice && (
        <InvoiceDetailsModal
          isOpen={Boolean(detailsInvoice)}
          onClose={() => setDetailsInvoice(null)}
          invoice={detailsInvoice}
          onEdit={(inv) => {
            setDetailsInvoice(null);
            setEditingInvoice(inv);
            setInvoiceFormOpen(true);
          }}
          onDelete={(id) => handleDeleteInvoice(id)}
          onDownloadPdf={(inv) => downloadInvoicePdf(inv, settings, invoiceTemplateSettings)}
        />
      )}

      {/* Invoice Template Settings Modal (DIN 5008 & Blanko-Briefpapier) */}
      {invoiceTemplateModalOpen && (
        <InvoiceTemplateModal
          isOpen={invoiceTemplateModalOpen}
          onClose={() => setInvoiceTemplateModalOpen(false)}
          template={invoiceTemplateSettings}
          clubSettings={settings}
          onSaveTemplate={handleSaveInvoiceTemplate}
          onTestExport={(tpl) => {
            if (invoices.length > 0) {
              downloadInvoicePdf(invoices[0], settings, tpl);
            }
          }}
        />
      )}

      {/* User & Role Management Modal (Admin only) */}
      {userManageOpen && (
        <UserManageModal
          currentUserId={currentUser?.id || ''}
          onClose={() => setUserManageOpen(false)}
          onUserChanged={() => {
            // Refresh session if active user was edited
            const updatedSession = AuthService.getSession();
            setAuthSession(updatedSession);
          }}
        />
      )}

      {/* Calendar Event Modal (Quick Action) */}
      {calendarEventModalOpen && (
        <CalendarEventModal
          isOpen={calendarEventModalOpen}
          onClose={() => setCalendarEventModalOpen(false)}
          event={null}
          categories={calendarCategories}
          members={members}
          departments={settings.departments}
          onSave={handleSaveCalendarEvent}
          clubSettingsAddress={formatClubAddress(settings.address)}
        />
      )}

      {/* Meeting Create/Edit Modal (Direct Dashboard Schnellaktion & Global Trigger) */}
      {meetingFormOpen && (
        <MeetingFormModal
          isOpen={meetingFormOpen}
          meetingToEdit={editingMeeting}
          members={members}
          clubSettings={settings}
          templateSettings={meetingTemplateSettings}
          onSave={async (savedMeeting) => {
            await handleSaveMeeting(savedMeeting);
            setMeetingFormOpen(false);
            setEditingMeeting(null);
          }}
          onClose={() => {
            setMeetingFormOpen(false);
            setEditingMeeting(null);
          }}
        />
      )}

      {/* Modular Dashboard Configuration Modal */}
      {isDashboardConfigOpen && (
        <DashboardConfigModal
          isOpen={isDashboardConfigOpen}
          onClose={() => setIsDashboardConfigOpen(false)}
          config={dashboardConfig}
          onSaveConfig={(newConfig) => {
            setDashboardConfig(newConfig);
            StorageService.saveDashboardConfig(newConfig);
          }}
          onResetToDefault={() => {
            setDashboardConfig(DEFAULT_DASHBOARD_CONFIG);
            StorageService.saveDashboardConfig(DEFAULT_DASHBOARD_CONFIG);
          }}
        />
      )}

      {/* Public Online Membership Application Modal / Standalone Mode */}
      {isPublicFormMode && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-50 w-full max-w-4xl min-h-screen sm:min-h-0 sm:rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col border border-slate-700">
            <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-600/30 text-blue-400 rounded-lg border border-blue-500/30">
                  <FileSignature className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Öffentliches Antragsformular — Live-Vorschau
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Dieser Dialog simuliert das Antragsformular für Interessenten am Smartphone oder PC
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPublicFormMode(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-700"
              >
                <X className="w-4 h-4" />
                <span>Schließen</span>
              </button>
            </div>
            <div className="p-3 sm:p-6 overflow-y-auto flex-1 bg-slate-100">
              <PublicApplicationForm
                settings={settings}
                templateSettings={applicationSettings}
                onSubmitApplication={async (app) => {
                  await StorageService.saveOnlineApplication(app);
                  await loadData();
                  setIsPublicFormMode(false);
                }}
                onClose={() => setIsPublicFormMode(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Hinweis bei fehlender Berechtigung */}
      {permissionNotice && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[calc(100%-2rem)]">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 px-4 py-3 flex items-start gap-3">
            <Lock className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
            <p className="text-xs leading-snug flex-1">{permissionNotice}</p>
            <button
              type="button"
              onClick={() => setPermissionNotice(null)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Hinweis schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
