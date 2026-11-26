/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { naechsteJahresNummer, naechsteKontaktNummer, naechsteNummerImSchema } from './utils/nummern';
import { useState, useEffect, useRef } from 'react';
import { leseArten } from './utils/mitgliedsarten';
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
  ClubContact,
  ContactType,
  ClubInvoice,
  InvoiceTemplateSettings,
  Meeting,
  MeetingTemplateSettings,
  MemberInventoryAssignment
} from './types';
import { StorageService } from './services/storage';
import { melde } from './utils/dialoge';
import { MitgliedLoeschenDialog, LoeschWahl } from './components/MitgliedLoeschenDialog';
import { moeglicheEmpfaenger, offenesMaterial } from './utils/mitgliedLoeschen';
import { formatClubAddress } from './utils/clubAddress';
import { applyAppearance } from './utils/appearance';
import { UserDashboardConfig } from './types/dashboard';
import { DEFAULT_DASHBOARD_CONFIG } from './data/defaultDashboard';
import { DEFAULT_MEETING_TEMPLATE } from './data/initialMeetings';
import { createDocumentFromInvoice, downloadInvoicePdf } from './services/invoicePdfService';
import { customCategoryService } from './services/customCategoryService';

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
import { AntragAusfuellen, AntragPruefen } from './components/AntragView';
import type { Antrag } from './utils/antragRegeln';
import { briefpapierFuerSitzungen } from './services/meetingPdfService';
import { MeetingsView } from './components/MeetingsView';

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
import { RechnungBezahltDialog } from './components/RechnungBezahltDialog';
import { BestaetigungsDialog } from './components/BestaetigungsDialog';
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
import { EinrichtungsModal } from './components/EinrichtungsModal';
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
  CalendarDays,
  FileSignature,
  SlidersHorizontal,
  Contact,
  ScrollText
} from 'lucide-react';

import { lokalesHeute } from './utils/mitgliedRegeln';
/** Die Menüpunkte der Navigationsleiste. */
type ActiveTab =
  | 'dashboard'
  | 'members'
  | 'member_analytics'
  | 'finance'
  | 'sepa'
  | 'invoices'
  | 'donations'
  | 'guv'
  | 'finance_analytics'
  | 'contacts'
  | 'calendar'
  | 'meetings'
  | 'inventory'
  | 'documents'
  | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [settingsActiveTab, setSettingsActiveTab] = useState<'general' | 'club' | 'backup' | 'support' | 'bugreport'>('general');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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

  /**
   * Braucht dieses Gerät noch die Ersteinrichtung (neuer Verein oder
   * Import)? Wird beim Start geprüft; siehe StorageService.brauchtEinrichtung.
   * Eine Anmeldung gibt es seit Runde 2 (R2) nicht mehr: Schutz ist das
   * Passwort des Rechners, wie am Handy.
   */
  const [needsSetup, setNeedsSetup] = useState(false);

  const pruefeEinrichtung = async () => {
    const braucht = await StorageService.brauchtEinrichtung();
    setNeedsSetup(braucht);
  };

  // Core App State
  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [documents, setDocuments] = useState<ClubDocument[]>([]);
  const [donations, setDonations] = useState<DonationReceipt[]>([]);
  // Aufnahme am Gerät (P29): 'ausfuellen' = das neue Mitglied füllt aus (Vollbild),
  // 'pruefen' = der Verein prüft. Der abgegebene Antrag liegt nur im Arbeitsspeicher.
  const [antragModus, setAntragModus] = useState<'ausfuellen' | 'pruefen' | null>(null);
  const [antragWartet, setAntragWartet] = useState<Antrag | null>(null);
  const [settings, setSettings] = useState<ClubSettings>({
    clubName: 'TSV Musterstadt 1890 e.V.',
    associationNumber: 'VR 48219 Amtsgericht Musterstadt',
    taxNumber: '112/5840/1922',
    creditorId: 'DE98ZZZ09999999999',
    address: 'Sportplatzweg 12, 12345 Musterstadt',
    chairman: 'Dr. Michael Sommer',
    treasurer: 'Sabine Weber',
    email: '',
    departments: ['Fußball', 'Tennis', 'Turnen', 'Leichtathletik', 'Schwimmen', 'Volleyball']
  });

  // Farbschema und Schrift des Vereins. Bis die Vereinsdaten geladen sind,
  // gilt der Zwischenspeicher des Geräts (siehe main.tsx).
  useEffect(() => {
    if (loading) return;
    applyAppearance(settings.colorScheme, settings.fontChoice);
  }, [loading, settings.colorScheme, settings.fontChoice]);

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
  // Laufende Rückfrage zu einer Rechnung: bezahlt markieren, zurücksetzen, stornieren, löschen (P12)
  const [rechnungAktion, setRechnungAktion] = useState<{
    art: 'bezahlt' | 'offen' | 'storno' | 'loeschen';
    rechnung: ClubInvoice;
  } | null>(null);
  const [rechnungFehler, setRechnungFehler] = useState<string | null>(null);
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
  // Termin, den der Kalender beim Öffnen anspringen soll (Klick im Dashboard, T-245)
  const [kalenderSprung, setKalenderSprung] = useState<{ eventId: string; datum: string } | null>(null);

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
  // `leise`: ohne Ladebildschirm neu laden, damit die gerade offene Seite
  // stehen bleibt (z. B. nach dem Umbenennen einer Sparte, T-82).
  const loadData = async (leise = false) => {
    try {
      if (leise !== true) setLoading(true);
      await StorageService.init();
      // Kontenrahmen des Vereins (eigene Konten, Anpassungen) aus der Datenbank; beim ersten Mal aus dem alten Browserspeicher umziehen
      await customCategoryService.laden();
      // „Ehrenmitglied“ als Status → als Mitgliedsart (einmalig je Bestand; auch nach dem Einspielen einer älteren Sicherung)
      const ehrenUmgestellt = await StorageService.ehrenStatusUmstellen();
      if (ehrenUmgestellt > 0) {
        void melde(
          `${ehrenUmgestellt === 1 ? 'Ein Mitglied hatte' : `${ehrenUmgestellt} Mitglieder hatten`} den Status „Ehrenmitglied“. ` +
            'Den gibt es nicht mehr; Ehrenmitglied ist jetzt eine Mitgliedsart. Status ist jetzt „Aktiv“, Art „Ehrenmitglied“. ' +
            'Der Beitrag ist unverändert geblieben – bitte prüfen, ob das so stimmt.'
        );
      }
      const [
        loadedMembers,
        loadedTransactions,
        loadedAccounts,
        loadedInventory,
        loadedSettings,
        loadedDocuments,
        loadedDonations,
        loadedFolders,
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
    } catch (err) {
      console.error('Failed to load local data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMeeting = async (meeting: Meeting) => {
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
    await StorageService.deleteMeeting(meetingId);
    setMeetings(prev => prev.filter(m => m.id !== meetingId));
  };

  const handleSaveMeetingTemplate = async (template: MeetingTemplateSettings) => {
    const saved = await StorageService.saveMeetingTemplate(template);
    setMeetingTemplateSettings(saved);
  };

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

  // Start: Einrichtung prüfen, dann Daten laden (ohne Anmeldung, R2)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      await pruefeEinrichtung();
      if (isMounted) await loadDataRef.current();
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute Next Member Number & Next Doc Number
  // Alle Nummern: höchste vorhandene plus eins (src/utils/nummern.ts), nicht
  // „Anzahl plus eins“ – das vergäbe nach dem Löschen eines Eintrags eine
  // Nummer doppelt.
  const nextMemberNumber = naechsteNummerImSchema(
    members.map(m => m.memberNumber),
    'M-0101'
  );
  const nextDocNumber = naechsteJahresNummer(
    'BE',
    transactions.map(t => t.documentNumber)
  );
  const nextInventoryNumber = naechsteNummerImSchema(
    inventory.map(i => i.itemNumber),
    'INV-001'
  );

  // Nächste freie Kontaktnummer (Format K-1001, wie im Bestand).
  const nextContactNumber = naechsteKontaktNummer(contacts.map(c => c.contactNumber));

  // Member CRUD handlers
  const handleSaveMember = async (memberData: Member, attachedDoc?: ClubDocument) => {
    await StorageService.saveMember(memberData);
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

  /**
   * Beim Löschen von Mitgliedern: Was geschieht mit ihren Dokumenten
   * (Unterlagen, Aufnahmeanträge) und mit noch ausgegebenem Material? Ein
   * Fenster wie am Handy (Paket U, T-352): Dokumente „mitlöschen“ vorgewählt
   * (Entscheidung Johannes 22.11.2026), Material zurück ins Inventar oder auf
   * ein anderes Mitglied übertragen. false = abbrechen.
   */
  const [loeschAnfrage, setLoeschAnfrage] = useState<{
    ids: string[];
    dokumente: number;
    material: MemberInventoryAssignment[];
    fertig: (w: LoeschWahl | null) => void;
  } | null>(null);

  const vorDemLoeschenAufraeumen = async (ids: string[]): Promise<boolean> => {
    // Dokumente aus der Liste der App, ohne Datenbankzugriff
    const s = new Set(ids);
    const betroffen = documents.filter(d => d.memberId && s.has(d.memberId));
    const material = offenesMaterial(await StorageService.getMemberInventoryAssignments(), ids);
    if (betroffen.length === 0 && material.length === 0) return true;
    const wahl = await new Promise<LoeschWahl | null>(resolve =>
      setLoeschAnfrage({ ids, dokumente: betroffen.length, material, fertig: resolve })
    );
    setLoeschAnfrage(null);
    if (!wahl) return false;
    try {
      if (material.length > 0) await StorageService.materialVonMitgliedernAufloesen(ids, wahl.material);
      if (betroffen.length > 0 && wahl.dokumente === 'loeschen') {
        for (const d of betroffen) await StorageService.deleteDocument(d.id);
        const weg = new Set(betroffen.map(d => d.id));
        setDocuments(prev => prev.filter(d => !weg.has(d.id)));
      }
    } catch (err) {
      await melde(`Das Löschen wurde abgebrochen: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
    return true;
  };

  const handleDeleteMember = async (id: string) => {
    if (!(await vorDemLoeschenAufraeumen([id]))) return;
    await StorageService.deleteMember(id);
    const updated = await StorageService.getMembers();
    setMembers(updated);
    if (detailsMember?.id === id) {
      setDetailsMember(null);
    }
  };

  const handleBulkUpdateMembers = async (ids: string[], updates: MemberBulkUpdates): Promise<string | null> => {
    const ergebnis = await StorageService.bulkUpdateMembers(ids, updates);
    const updated = await StorageService.getMembers();
    setMembers(updated);
    if (detailsMember && ids.includes(detailsMember.id)) {
      const refreshed = updated.find(m => m.id === detailsMember.id);
      if (refreshed) setDetailsMember(refreshed);
    }
    // Hinweis, was wegen der Formularregeln nicht geändert wurde (T-133)
    if (ergebnis.gesperrt.length === 0) return null;
    const felder = Array.from(new Set(ergebnis.gesperrt.flatMap(g => g.felder))).join(', ');
    const namen = ergebnis.gesperrt.slice(0, 5).map(g => g.name).join(', ');
    const mehr = ergebnis.gesperrt.length > 5 ? ` und ${ergebnis.gesperrt.length - 5} weitere` : '';
    return `Bei ${ergebnis.gesperrt.length} ${ergebnis.gesperrt.length === 1 ? 'Mitglied' : 'Mitgliedern'} wurde ${felder} nicht geändert, weil sie ausgetreten oder beitragsfrei sind (${namen}${mehr}). Erst Status oder Zahlweise ändern, dann den Beitrag.`;
  };

  const handleBulkDeleteMembers = async (ids: string[]) => {
    if (!(await vorDemLoeschenAufraeumen(ids))) return;
    await StorageService.deleteMultipleMembers(ids);
    const updated = await StorageService.getMembers();
    setMembers(updated);
    if (detailsMember && ids.includes(detailsMember.id)) {
      setDetailsMember(null);
    }
  };

  // Batch Member CSV Import
  const handleBatchMemberImport = async (importedMembers: Member[]) => {
    await StorageService.batchSaveMembers(importedMembers);
    const updated = await StorageService.getMembers();
    setMembers(updated);
  };

  // Contact CRUD handlers
  const handleSaveContact = async (contactData: ClubContact) => {
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
    await StorageService.deleteContact(id);
    const updated = await StorageService.getContacts();
    setContacts(updated);
    if (detailsContact?.id === id) {
      setDetailsContact(null);
    }
  };

  const handleBulkDeleteContacts = async (ids: string[]) => {
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
    for (const c of importedContacts) {
      await StorageService.saveContact(c);
    }
    const updated = await StorageService.getContacts();
    setContacts(updated);
  };

  const handleQuickCreateContact = (initialName: string, initialType?: ContactType) => {
    setEditingContact(null);
    setInitialContactFormName(initialName);
    setInitialContactFormType(initialType);
    setContactFormOpen(true);
  };

  // Transaction CRUD handlers
  /**
   * Nach dem Speichern einer Buchung mit Beleg: Der Beleg steht auch in der
   * Dokumentenverwaltung, und dafür wurde womöglich ein Ordner „Belege <Jahr>“
   * angelegt. Beides neu laden, sonst zeigt die Dokumentenansicht bis zum
   * nächsten Start den alten Stand.
   */
  const ladeBuchungenUndBelegeNeu = async () => {
    const [updated, updatedDocs, updatedFolders] = await Promise.all([
      StorageService.getTransactions(),
      StorageService.getDocuments(),
      StorageService.getFolders()
    ]);
    setTransactions(updated);
    setDocuments(updatedDocs);
    setFolders(updatedFolders);
  };

  const handleSaveTransaction = async (txData: Transaction) => {
    await StorageService.saveTransaction(txData);
    await ladeBuchungenUndBelegeNeu();
    setTxFormOpen(false);
    setEditingTx(null);
  };

  const handleDeleteTransaction = async (id: string) => {
    await StorageService.deleteTransaction(id);
    // Mit der Buchung verschwindet ihr Beleg aus der Dokumentenverwaltung;
    // deshalb auch die Dokumente neu laden.
    const [updated, updatedDocs] = await Promise.all([
      StorageService.getTransactions(),
      StorageService.getDocuments()
    ]);
    setTransactions(updated);
    setDocuments(updatedDocs);
  };

  const handleBulkUpdateTransactions = async (ids: string[], updates: TransactionBulkUpdates) => {
    const bericht = await StorageService.bulkUpdateTransactions(ids, updates);
    const updated = await StorageService.getTransactions();
    setTransactions(updated);
    // FinanceView meldet damit übersprungene Umbuchungen und aufgeteilte Buchungen
    return bericht;
  };

  const handleBulkDeleteTransactions = async (ids: string[]) => {
    await StorageService.deleteMultipleTransactions(ids);
    const [updated, updatedDocs] = await Promise.all([
      StorageService.getTransactions(),
      StorageService.getDocuments()
    ]);
    setTransactions(updated);
    setDocuments(updatedDocs);
  };

  // Camera Receipt Scanner Handlers
  const handleScannerLinkToTransaction = async (transactionId: string, receipt: ReceiptAttachment) => {
    const targetTx = transactions.find(t => t.id === transactionId);
    if (!targetTx) return;
    const updatedTx: Transaction = {
      ...targetTx,
      receipt,
      updatedAt: new Date().toISOString()
    };
    await StorageService.saveTransaction(updatedTx);
    await ladeBuchungenUndBelegeNeu();
    setReceiptScannerOpen(false);
    setScannerTargetTx(null);
  };

  const handleScannerCreateTransactionWithReceipt = (receipt: ReceiptAttachment) => {
    const newTxStub: Transaction = {
      id: `tx-${Date.now()}`,
      documentNumber: nextDocNumber,
      date: lokalesHeute(),
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
    setScannerTargetTx(tx);
    setReceiptScannerOpen(true);
  };

  // Bank CSV Batch Import
  const handleBankImport = async (importedTxs: Transaction[]) => {
    await StorageService.batchSaveTransactions(importedTxs);
    const updated = await StorageService.getTransactions();
    setTransactions(updated);
  };

  // Excel & Google Sheets Batch Import
  const handleBatchTransactionImport = async (importedTxs: Transaction[]) => {
    await StorageService.batchSaveTransactions(importedTxs);
    const updated = await StorageService.getTransactions();
    setTransactions(updated);
  };

  // Account handlers
  const handleSaveAccount = async (account: FinancialAccount) => {
    await StorageService.saveAccount(account);
    const updated = await StorageService.getAccounts();
    setAccounts(updated);
  };

  /**
   * Gibt null bei Erfolg zurück, sonst die Meldung für das Kontenfenster
   * (z. B. wenn Buchungen am Konto hängen und kein Zielkonto gewählt ist).
   */
  const handleDeleteAccount = async (id: string, uebertragenAuf?: string): Promise<string | null> => {
    try {
      await StorageService.deleteAccount(id, uebertragenAuf);
    } catch (err: any) {
      return err?.message || 'Das Konto konnte nicht gelöscht werden.';
    }
    const [updated, updatedTxs] = await Promise.all([
      StorageService.getAccounts(),
      StorageService.getTransactions()
    ]);
    setAccounts(updated);
    setTransactions(updatedTxs);
    return null;
  };

  const handleReorderAccounts = async (reordered: FinancialAccount[]) => {
    const withOrder = reordered.map((a, idx) => ({ ...a, order: idx }));
    setAccounts(withOrder);
    await StorageService.saveAccounts(withOrder);
  };

  // Inventory CRUD handlers
  const handleSaveInventoryItem = async (item: InventoryItem) => {
    await StorageService.saveInventoryItem(item);
    const updated = await StorageService.getInventory();
    setInventory(updated);
    setInventoryFormOpen(false);
    setEditingInventoryItem(null);
  };

  const handleDeleteInventoryItem = async (id: string) => {
    try {
      await StorageService.deleteInventoryItem(id);
    } catch (err) {
      // Noch an Mitglieder ausgegeben: Die Inventaransicht sperrt das Löschen
      // schon vorher und nennt den Grund; der Speicher lehnt es zusätzlich ab.
      console.warn('Gegenstand wurde nicht gelöscht:', err);
    }
    const updated = await StorageService.getInventory();
    setInventory(updated);
  };

  const handleBulkUpdateInventoryItems = async (ids: string[], updates: InventoryBulkUpdates) => {
    await StorageService.bulkUpdateInventoryItems(ids, updates);
    const updated = await StorageService.getInventory();
    setInventory(updated);
  };

  const handleBulkDeleteInventoryItems = async (ids: string[]) => {
    await StorageService.deleteMultipleInventoryItems(ids);
    const updated = await StorageService.getInventory();
    setInventory(updated);
  };

  // Settings handler
  const handleSaveSettings = async (newSettings: ClubSettings) => {
    await StorageService.saveSettings(newSettings);
    setSettings(newSettings);
  };

  // Document Management handlers
  const handleSaveBatchDocuments = async (newDocs: ClubDocument[]) => {
    await StorageService.saveBatchDocuments(newDocs);
    const updated = await StorageService.getDocuments();
    setDocuments(updated);
  };

  const handleSaveSingleDocument = async (doc: ClubDocument) => {
    await StorageService.saveDocument(doc);
    const updated = await StorageService.getDocuments();
    setDocuments(updated);
  };

  const handleUpdateDocument = async (updatedDoc: ClubDocument) => {
    await StorageService.saveDocument(updatedDoc);
    const updated = await StorageService.getDocuments();
    setDocuments(updated);
    if (docViewerItem?.id === updatedDoc.id) {
      setDocViewerItem(updatedDoc);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    await StorageService.deleteDocument(id);
    const updated = await StorageService.getDocuments();
    setDocuments(updated);
    if (docViewerItem?.id === id) {
      setDocViewerItem(null);
    }
  };

  const handleBatchDeleteDocuments = async (ids: string[]) => {
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
    await StorageService.saveFolder(folderData);
    const updated = await StorageService.getFolders();
    setFolders(updated);
  };

  const handleDeleteFolder = async (folderId: string) => {
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
    await StorageService.batchMoveDocumentsToFolder(docIds, targetFolderId, targetCategory);
    const updated = await StorageService.getDocuments();
    setDocuments(updated);
    if (docViewerItem && docIds.includes(docViewerItem.id)) {
      const refreshed = updated.find(d => d.id === docViewerItem.id);
      if (refreshed) setDocViewerItem(refreshed);
    }
  };

  // Spenden & Zuwendungsbestätigungen (BMF) Handlers
  const nextDonationReceiptNumber = naechsteJahresNummer(
    'ZB',
    donations.map(d => d.receiptNumber)
  );

  const handleSaveDonationReceipt = async (
    receipt: DonationReceipt,
    options: {
      autoArchiveDoc: boolean;
      autoCreateTx: boolean;
      targetAccountId?: string;
      buchungAnpassen?: boolean;
    }
  ) => {
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

  const handleDeleteDonationReceipt = async (id: string, buchungMitLoeschen = false) => {
    await StorageService.deleteDonationReceipt(id, buchungMitLoeschen);
    const [updatedDonations, updatedDocs, updatedTxs] = await Promise.all([
      StorageService.getDonations(),
      StorageService.getDocuments(),
      StorageService.getTransactions()
    ]);
    setDonations(updatedDonations);
    setDocuments(updatedDocs);
    setTransactions(updatedTxs);
  };

  const handleEditDonationReceipt = (receipt: DonationReceipt) => {
    setEditingDonation(receipt);
    setDonationFormOpen(true);
  };

  const handleOpenCreateDonation = () => {
    setEditingDonation(null);
    setDonationFormOpen(true);
  };

  // Invoicing CRUD Handlers (DIN 5008 & Blanko-Briefpapier)
  const nextInvoiceNumber = naechsteJahresNummer(
    'RE',
    invoices.map(inv => inv.invoiceNumber)
  );

  const handleSaveInvoice = async (invoice: ClubInvoice, saveToDocuments: boolean = true, buchungAnpassen = false) => {
    const toSave: ClubInvoice = { ...invoice };
    if (saveToDocuments) {
      try {
        // Ein Dokument je Rechnung, im Ordner „Belege <Jahr> / Ausgangsrechnungen“ (D-47)
        const doc = await createDocumentFromInvoice(invoice, settings, invoiceTemplateSettings);
        const abgelegt = await StorageService.saveInvoicePdfDocument(invoice, doc);
        toSave.documentId = abgelegt.id;
      } catch (docErr) {
        console.warn('Could not auto-archive invoice document:', docErr);
      }
    }
    await StorageService.saveInvoice(toSave);
    // Verknüpfte Buchung dem neuen Betrag folgen lassen, wenn so gewählt
    if (buchungAnpassen) await StorageService.angleichenRechnungsBuchung(toSave);
    const [updatedInvoices, updatedDocs, updatedTxs] = await Promise.all([
      StorageService.getInvoices(),
      StorageService.getDocuments(),
      StorageService.getTransactions()
    ]);
    setInvoices(updatedInvoices);
    setDocuments(updatedDocs);
    setTransactions(updatedTxs);
    setInvoiceFormOpen(false);
    setEditingInvoice(null);
    setPrefillInvoiceRecipient(null);
  };

  /** Rechnungen, Buchungen und Dokumente neu laden; die geöffneten Details auf den neuen Stand bringen. */
  const ladeRechnungenNeu = async (id?: string) => {
    const [updatedInvoices, updatedDocs, updatedTxs] = await Promise.all([
      StorageService.getInvoices(),
      StorageService.getDocuments(),
      StorageService.getTransactions()
    ]);
    setInvoices(updatedInvoices);
    setDocuments(updatedDocs);
    setTransactions(updatedTxs);
    if (id) setDetailsInvoice(prev => (prev?.id === id ? updatedInvoices.find(i => i.id === id) ?? null : prev));
  };

  // Löschen fragt immer nach (vorher löschte der Knopf in den Details ohne
  // Rückfrage); gehört eine Buchung dazu, auch, ob sie mit soll (wie Android).
  const handleDeleteInvoice = (id: string) => {
    const r = invoices.find(i => i.id === id);
    if (r) setRechnungAktion({ art: 'loeschen', rechnung: r });
  };

  const loescheRechnung = async (id: string, buchungMitLoeschen: boolean) => {
    await StorageService.deleteInvoice(id, buchungMitLoeschen);
    await ladeRechnungenNeu();
    if (detailsInvoice?.id === id) {
      setDetailsInvoice(null);
    }
  };

  /** Statusknöpfe der Rechnungsdetails (D-46): vorher ohne Wirkung. */
  const handleInvoiceStatus = (inv: ClubInvoice, neu: ClubInvoice['status']) => {
    setRechnungFehler(null);
    if (neu === 'paid') setRechnungAktion({ art: 'bezahlt', rechnung: inv });
    else if (neu === 'cancelled') setRechnungAktion({ art: 'storno', rechnung: inv });
    else if (neu === 'open') {
      const mitBuchung = inv.status === 'paid' && inv.linkedTransactionId && transactions.some(t => t.id === inv.linkedTransactionId);
      if (mitBuchung) setRechnungAktion({ art: 'offen', rechnung: inv });
      else void setzeRechnungOffen(inv.id, false);
    }
  };

  const setzeRechnungOffen = async (id: string, buchungMitLoeschen: boolean) => {
    await StorageService.resetInvoiceToOpen(id, buchungMitLoeschen);
    await ladeRechnungenNeu(id);
  };

  const handleBulkDeleteInvoices = async (ids: string[]) => {
    for (const id of ids) {
      await StorageService.deleteInvoice(id);
    }
    const [updatedInvoices, updatedDocs] = await Promise.all([
      StorageService.getInvoices(),
      StorageService.getDocuments()
    ]);
    setInvoices(updatedInvoices);
    setDocuments(updatedDocs);
  };


  const handleSaveInvoiceTemplate = async (newTemplate: InvoiceTemplateSettings) => {
    await StorageService.saveInvoiceTemplate(newTemplate);
    setInvoiceTemplateSettings(newTemplate);
    setInvoiceTemplateModalOpen(false);
  };

  const handleCreateInvoiceForContact = (contact: ClubContact) => {
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
  // --- Neues Mitglied aufnehmen (P29) -------------------------------------

  /** Öffnet den Antrag; wartet schon ein abgegebener Antrag, zuerst dessen Prüfung. */
  const oeffneAufnahme = () => setAntragModus(antragWartet ? 'pruefen' : 'ausfuellen');

  const handleOpenCreateCalendarEvent = async () => {
    try {
      const cats = await StorageService.getCalendarCategories();
      setCalendarCategories(cats);
    } catch (e) {
      console.error('Error fetching calendar categories:', e);
    }
    setCalendarEventModalOpen(true);
  };

  const handleSaveCalendarEvent = async (eventData: CalendarEvent) => {
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

  // Auf diesem Gerät liegt noch kein Verein vor (frisch oder nach
  // "Alle lokalen Daten löschen"): Einrichtung statt App.
  if (needsSetup) {
    return <EinrichtungsModal onFertig={() => { setNeedsSetup(false); loadData(); }} />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden dark:bg-slate-800 dark:text-white">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar (Professional Polish Dark Navy/Slate-900) */}
      <aside
        className={`vm-sidebar fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden shadow-md border border-slate-700/50 shrink-0 dark:bg-slate-900">
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
                ['members', 'member_analytics'].includes(activeTab)
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
                  onClick={() => {
                    setActiveTab('members');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'members'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span>Mitgliederverwaltung</span>
                </button>

                {/* Aufnahme am Gerät (P29): öffnet den Antrag, kein eigener Bereich */}
                <button
                  type="button"
                  onClick={() => {
                    oeffneAufnahme();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <div className="flex items-center gap-2">
                    <FileSignature className="w-3.5 h-3.5 text-blue-400" />
                    <span>Neues Mitglied aufnehmen</span>
                  </div>
                  {antragWartet && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500 text-white">prüfen</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('member_analytics');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'member_analytics'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Mitglieder-Statistiken</span>
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
                  onClick={() => {
                    setActiveTab('finance');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'finance'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Buchungen & Journal</span>
                </button>

                {/* 3b. Beitragslauf (SEPA) */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('sepa');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'sepa'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
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
                </button>

                {/* 3c. EÜR / GuV */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('guv');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'guv'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>EÜR / GuV</span>
                </button>

                {/* 3d. Rechnungen & Vorlagen */}
                <button
                  id="nav-btn-invoices"
                  type="button"
                  onClick={() => {
                    setActiveTab('invoices');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeTab === 'invoices'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Rechnungen</span>
                </button>

                {/* 3e. Geld- & Sachzuwendungen (BMF Muster) */}
                <button
                  id="nav-btn-donations"
                  type="button"
                  onClick={() => {
                    setActiveTab('donations');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'donations'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <HeartHandshake className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Spenden</span>
                </button>

                {/* 3e. Finanz-Auswertungen */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('finance_analytics');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'finance_analytics'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <PieChart className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Finanz-Auswertungen</span>
                </button>
              </div>
            )}
          </div>

          {/* Kontakte (eigenständiger Menüpunkt zwischen Finanzen und Kalender) */}
          <div className="pt-2">
            <button
              id="nav-btn-contacts"
              type="button"
              onClick={() => {
                setActiveTab('contacts');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'contacts'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <Contact className={`w-4 h-4 ${activeTab === 'contacts' ? 'text-white' : 'text-cyan-400'}`} />
                <span>Kontakte</span>
              </div>
            </button>
          </div>

          {/* 4. Kalender */}
          <div className="pt-2">
            <button
              id="nav-btn-calendar"
              type="button"
              onClick={() => {
                setActiveTab('calendar');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <CalendarDays className={`w-4 h-4 ${activeTab === 'calendar' ? 'text-white' : 'text-indigo-400'}`} />
                <span>Kalender</span>
              </div>
            </button>
          </div>

          {/* Sitzungen & Protokolldienst */}
          <div className="pt-2">
            <button
              id="nav-btn-meetings"
              type="button"
              onClick={() => {
                setActiveTab('meetings');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'meetings'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <ScrollText className={`w-4 h-4 ${activeTab === 'meetings' ? 'text-white' : 'text-rose-400'}`} />
                <span>Sitzungen</span>
              </div>
            </button>
          </div>

          {/* 5. Inventar */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('inventory');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'inventory'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Package className="w-4 h-4 text-purple-400" />
              <span>Inventar</span>
            </button>
          </div>

          {/* 6. Dokumente */}
          <div className="pt-2">
            <button
              id="nav-btn-documents"
              type="button"
              onClick={() => {
                setActiveTab('documents');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'documents'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <FolderArchive className="w-4 h-4 text-amber-400" />
              <span>Dokumente</span>
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
              setActiveTab('settings');
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

          {/* Versionsanzeige mit Hinweis auf neue Versionen */}
          <AppVersionBadge />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="vm-page flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Top Header Bar */}
        <header className="vm-header h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between shrink-0 z-20 gap-3">
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
            <div className="w-8 h-8 rounded-lg bg-white p-0.5 flex items-center justify-center overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700 shrink-0 lg:hidden dark:bg-slate-900">
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
                {activeTab === 'member_analytics' && 'Mitglieder-Statistiken & Demografie'}
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
            {/* Einstellungen (früher Benutzermenü mit Abmelden und Sperren; seit R2 ohne Anmeldung) */}
            <button
              type="button"
              onClick={() => {
                setSettingsActiveTab('general');
                setActiveTab('settings');
              }}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors border border-transparent hover:border-slate-200 dark:hover:text-slate-200 dark:hover:bg-slate-700 dark:hover:border-slate-800"
              title="Systemeinstellungen"
            >
              <Settings className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </header>

        {/* Scrollable View Area */}
        {/* Kein overflow-x-auto mehr hier — das war ein Zwischenschritt und
            hat einen neuen Fehler verursacht: Bei langen Seiten (viele
            Einträge, Filter, Kacheln oberhalb der Tabelle) landete der
            seitliche Scrollbalken ganz unten an der Kante der GESAMTEN Seite,
            oft weit außerhalb des sichtbaren Bereichs — praktisch
            unauffindbar. Die Tabellen regeln ihr seitliches Scrollen jetzt
            wieder selbst, aber diesmal mit einer eigenen Höhenbegrenzung
            (siehe Kommentar in MembersView.tsx), damit der mitscrollende
            Kopf trotzdem funktioniert, ohne dass der Scrollbalken verloren
            geht. */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto">
          <div className="max-w-[2400px] mx-auto space-y-6">
            {/* Tab 0: Dashboard */}
            {activeTab === 'dashboard' && (
              <DashboardView
                members={members}
                transactions={transactions}
                accounts={accounts}
                inventory={inventory}
                documents={documents}
                donations={donations}
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
                onNavigate={(tab) => setActiveTab(tab)}
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
                onOpenMember={(id) => {
                  const m = members.find(x => x.id === id);
                  if (m) setDetailsMember(m);
                }}
                onOpenEvent={(eventId, datum) => {
                  setKalenderSprung({ eventId, datum });
                  setActiveTab('calendar');
                }}
                onOpenCreateInventory={() => {
                  setEditingInventoryItem(null);
                  setInventoryFormOpen(true);
                }}
                onOpenNewDocument={() => setNewDocChoiceOpen(true)}
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
              />
            )}

            {/* Tab 2: Member Analytics */}
            {activeTab === 'member_analytics' && (
              <MemberAnalyticsView members={members} settings={settings} />
            )}

            {/* Tab: SEPA Direct Debit & Contribution Run */}
            {activeTab === 'sepa' && (
              <SepaRunView
                members={members}
                settings={settings}
                accounts={accounts}
                onOpenSettings={() => setActiveTab('settings')}
                // Leise neu laden: mit Ladebildschirm würde die Ansicht neu aufgebaut
                // und die Rückfrage zur Folgelastschrift ginge verloren (wie T-82)
                onRefreshData={() => loadData(true)}
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
                />
            )}

            {/* Tab 5: Finance Analytics */}
            {activeTab === 'finance_analytics' && (
              <FinanceAnalyticsView
                transactions={transactions}
                accounts={accounts}
                settings={settings}
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
                onSaveItem={handleSaveInventoryItem}
                onOpenMember={(m) => setDetailsMember(m)}
                onBulkDeleteItems={handleBulkDeleteInventoryItems}
                />
            )}

            {/* Tab: Calendar & Events */}
            {activeTab === 'calendar' && (
              <CalendarView
                members={members}
                settings={settings}
                sprung={kalenderSprung}
                onSprungErledigt={() => setKalenderSprung(null)}
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
                invoiceTemplateSettings={invoiceTemplateSettings}
                onOpenBriefpapier={() => {
                  // Das Briefpapier liegt jetzt in den Einstellungen (Vereinsstammdaten)
                  setSettingsActiveTab('club');
                  setActiveTab('settings');
                }}
                documents={documents}
                onProtokollAbgelegt={async (m, doc) => {
                  // Nur die geänderten Einträge austauschen; Ordner neu lesen, falls ein Standardordner angelegt wurde (C3)
                  setMeetings(prev => prev.map(x => (x.id === m.id ? m : x)));
                  setDocuments(prev => [...prev.filter(d => d.id !== doc.id), doc]);
                  setFolders(await StorageService.getFolders());
                }}
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
                />
            )}

            {/* Tab 8: Dedicated Settings & Administration Page */}
            {activeTab === 'settings' && (
              <SettingsView
                settings={settings}
                members={members}
                onSaveSettings={handleSaveSettings}
                onBriefpapierGeaendert={setInvoiceTemplateSettings}
                onDataReload={(leise?: boolean) => loadData(leise)}
                currentTheme={theme}
                onThemeChange={(newTheme) => setTheme(newTheme)}
                initialTab={settingsActiveTab}
                onTabChange={(tab) => setSettingsActiveTab(tab)}
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
          existingMembers={members}
          beitragsVorgaben={settings.membershipFeeDefaults}
          arten={leseArten(settings.membershipTypes)}
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
          nextItemNumber={nextInventoryNumber}
          existingItems={inventory}
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
      {loeschAnfrage && (
        <MitgliedLoeschenDialog
          anzahlMitglieder={loeschAnfrage.ids.length}
          dokumente={loeschAnfrage.dokumente}
          material={loeschAnfrage.material}
          empfaenger={moeglicheEmpfaenger(members, loeschAnfrage.ids)}
          onLoeschen={w => loeschAnfrage.fertig(w)}
          onAbbrechen={() => loeschAnfrage.fertig(null)}
        />
      )}
      {detailsMember && (
        <MemberDetailsDrawer
          member={detailsMember}
          settings={settings}
          inventory={inventory}
          allMembers={members}
          onClose={() => setDetailsMember(null)}
          onDelete={handleDeleteMember}
          onSaveMember={handleSaveMember}
          documents={documents}
          folders={folders}
          onDokumentGespeichert={(doc, neuerOrdner) => {
            // Nur den einen Eintrag austauschen, statt alle Dokumente neu aus der Datenbank zu lesen
            setDocuments(prev => [...prev.filter(d => d.id !== doc.id), doc]);
            if (neuerOrdner) setFolders(prev => (prev.some(f => f.id === neuerOrdner.id) ? prev : [...prev, neuerOrdner]));
          }}
          onDokumentGeloescht={id => setDocuments(prev => prev.filter(d => d.id !== id))}
          onEdit={(m) => {
            setDetailsMember(null);
            setEditingMember(m);
            setMemberFormOpen(true);
          }}
                />
      )}

      {/* Neues Mitglied aufnehmen (P29): Ausfüllen durch das neue Mitglied, Prüfen durch den Verein */}
      {antragModus === 'ausfuellen' && (
        <AntragAusfuellen
          settings={settings}
          dokumente={documents}
          onAbgegeben={a => setAntragWartet(a)}
          onWeiter={() => setAntragModus('pruefen')}
          onAbbruch={() => {
            setAntragWartet(null);
            setAntragModus(null);
          }}
        />
      )}
      {antragModus === 'pruefen' && antragWartet && (
        <AntragPruefen
          antrag={antragWartet}
          settings={settings}
          members={members}
          briefpapier={briefpapierFuerSitzungen(meetingTemplateSettings, invoiceTemplateSettings)}
          onAufgenommen={async m => {
            setAntragWartet(null);
            setAntragModus(null);
            await loadData(true);
            setActiveTab('members');
            setDetailsMember(m);
          }}
          onVerworfen={() => {
            setAntragWartet(null);
            setAntragModus(null);
          }}
          onSchliessen={() => setAntragModus(null)}
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
          departments={settings.departments}
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
          existingContacts={contacts}
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
          transactions={transactions}
          existingReceipts={donations}
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
          existingTransactions={transactions}
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
          transactions={transactions}
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
          existingInvoices={invoices}
          transactions={transactions}
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
          onToggleStatus={handleInvoiceStatus}
          statusFehler={rechnungFehler}
        />
      )}

      {rechnungAktion?.art === 'bezahlt' && (
        <RechnungBezahltDialog
          rechnung={rechnungAktion.rechnung}
          konten={accounts}
          hatBuchung={Boolean(
            rechnungAktion.rechnung.linkedTransactionId &&
              transactions.some(t => t.id === rechnungAktion.rechnung.linkedTransactionId)
          )}
          onAbbrechen={() => setRechnungAktion(null)}
          onBestaetigen={async a => {
            await StorageService.markInvoicePaid(rechnungAktion.rechnung.id, a);
            const id = rechnungAktion.rechnung.id;
            setRechnungAktion(null);
            await ladeRechnungenNeu(id);
          }}
        />
      )}
      {rechnungAktion?.art === 'offen' && (
        <BestaetigungsDialog
          titel={`Rechnung ${rechnungAktion.rechnung.invoiceNumber} wieder auf „offen“ setzen?`}
          text="Zu dieser Rechnung gehört eine Einnahmebuchung. Soll sie gelöscht werden? Sonst bleibt sie stehen, ist aber nicht mehr mit der Rechnung verknüpft."
          gefahr
          bestaetigenText="Buchung löschen"
          alternativText="Buchung behalten"
          onBestaetigen={async () => {
            const id = rechnungAktion.rechnung.id;
            setRechnungAktion(null);
            await setzeRechnungOffen(id, true);
          }}
          onAlternative={async () => {
            const id = rechnungAktion.rechnung.id;
            setRechnungAktion(null);
            await setzeRechnungOffen(id, false);
          }}
          onAbbrechen={() => setRechnungAktion(null)}
        />
      )}
      {rechnungAktion?.art === 'storno' && (
        <BestaetigungsDialog
          titel={`Rechnung ${rechnungAktion.rechnung.invoiceNumber} stornieren?`}
          text="Die Rechnung bleibt mit ihrer Nummer erhalten, gilt aber nicht mehr als Forderung."
          gefahr
          bestaetigenText="Stornieren"
          onBestaetigen={async () => {
            const id = rechnungAktion.rechnung.id;
            setRechnungAktion(null);
            try {
              await StorageService.cancelInvoice(id);
              await ladeRechnungenNeu(id);
            } catch (err: any) {
              setRechnungFehler(err?.message || 'Die Rechnung konnte nicht storniert werden.');
            }
          }}
          onAbbrechen={() => setRechnungAktion(null)}
        />
      )}
      {rechnungAktion?.art === 'loeschen' && (
        <BestaetigungsDialog
          titel={`Rechnung ${rechnungAktion.rechnung.invoiceNumber} löschen?`}
          text={
            rechnungAktion.rechnung.linkedTransactionId && transactions.some(t => t.id === rechnungAktion.rechnung.linkedTransactionId)
              ? 'Zu dieser Rechnung gehört eine Buchung. Soll sie mitgelöscht werden? Das abgelegte PDF wird in jedem Fall gelöscht.'
              : 'Die Rechnung und ihr abgelegtes PDF werden gelöscht.'
          }
          gefahr
          bestaetigenText={
            rechnungAktion.rechnung.linkedTransactionId && transactions.some(t => t.id === rechnungAktion.rechnung.linkedTransactionId)
              ? 'Rechnung und Buchung löschen'
              : 'Löschen'
          }
          alternativText={
            rechnungAktion.rechnung.linkedTransactionId && transactions.some(t => t.id === rechnungAktion.rechnung.linkedTransactionId)
              ? 'Nur die Rechnung löschen'
              : undefined
          }
          onAlternative={async () => {
            const id = rechnungAktion.rechnung.id;
            setRechnungAktion(null);
            await loescheRechnung(id, false);
          }}
          onBestaetigen={async () => {
            const id = rechnungAktion.rechnung.id;
            setRechnungAktion(null);
            await loescheRechnung(id, true);
          }}
          onAbbrechen={() => setRechnungAktion(null)}
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
    </div>
  );
}
