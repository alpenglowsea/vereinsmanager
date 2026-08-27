/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Member,
  Transaction,
  FinancialAccount,
  ClubSettings,
  ReceiptAttachment,
  InventoryItem,
  MemberBulkUpdates,
  ClubDocument,
  DocumentCategory,
  DocumentFolder,
  DonationReceipt,
  CalendarEvent,
  CalendarEventCategory,
  OnlineMembershipApplication,
  ApplicationTemplateSettings
} from './types';
import { StorageService } from './services/storage';
import { AuthService } from './services/authService';
import { AppUser, UserAuthSession } from './types';

// Views
import { DashboardView } from './components/DashboardView';
import { MembersView } from './components/MembersView';
import { MemberAnalyticsView } from './components/MemberAnalyticsView';
import { FinanceView } from './components/FinanceView';
import { GuvReportView } from './components/GuvReportView';
import { FinanceAnalyticsView } from './components/FinanceAnalyticsView';
import { DonationsView } from './components/DonationsView';
import { InventoryView } from './components/InventoryView';
import { SepaRunView } from './components/SepaRunView';
import { DocumentsView } from './components/DocumentsView';
import { CalendarView } from './components/CalendarView';
import { OnlineApplicationsView } from './components/OnlineApplicationsView';
import { PublicApplicationForm } from './components/PublicApplicationForm';

// Modals & Drawers
import { MemberFormModal } from './components/MemberFormModal';
import { MemberDetailsDrawer } from './components/MemberDetailsDrawer';
import { MemberImportModal } from './components/MemberImportModal';
import { TransactionFormModal } from './components/TransactionFormModal';
import { TransactionImportModal } from './components/TransactionImportModal';
import { BankImportModal } from './components/BankImportModal';
import { AccountManageModal } from './components/AccountManageModal';
import { ReceiptViewerModal } from './components/ReceiptViewerModal';
import { ReceiptCameraScannerModal } from './components/ReceiptCameraScannerModal';
import { SettingsPrivacyModal } from './components/SettingsPrivacyModal';
import { InventoryFormModal } from './components/InventoryFormModal';
import { DeploymentHubModal } from './components/DeploymentHubModal';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import { DocumentUploadModal } from './components/DocumentUploadModal';
import { DocumentEditModal } from './components/DocumentEditModal';
import { NewDocumentChoiceModal } from './components/NewDocumentChoiceModal';
import { DonationFormModal } from './components/DonationFormModal';
import { CalendarEventModal } from './components/CalendarEventModal';
import { LoginScreen } from './components/LoginScreen';
import { UserManageModal } from './components/UserManageModal';

// Icons
import {
  LayoutDashboard,
  Users,
  BarChart3,
  CreditCard,
  Wallet,
  FileSpreadsheet,
  PieChart,
  ShieldCheck,
  Settings,
  Plus,
  Building2,
  HardDrive,
  CheckCircle2,
  Menu,
  X,
  Search,
  Database,
  Lock,
  Package,
  ChevronDown,
  ChevronRight,
  Cloud,
  Server,
  Globe,
  FolderArchive,
  FileText,
  Camera,
  Upload,
  HeartHandshake,
  UserCheck,
  LogOut,
  ShieldAlert,
  UserCog,
  KeyRound,
  Shield,
  Calendar as CalendarIcon,
  CalendarDays,
  FileSignature,
  Inbox,
  FileCheck
} from 'lucide-react';

type ActiveTab =
  | 'dashboard'
  | 'calendar'
  | 'members'
  | 'online_applications'
  | 'member_analytics'
  | 'sepa'
  | 'finance'
  | 'guv'
  | 'finance_analytics'
  | 'donations'
  | 'inventory'
  | 'documents';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deploymentMode, setDeploymentMode] = useState<import('./types').DeploymentMode>(StorageService.getDeploymentMode());
  const [deploymentHubOpen, setDeploymentHubOpen] = useState(false);

  // Authentication & RBAC State
  const [authSession, setAuthSession] = useState<UserAuthSession>(() => AuthService.getSession());
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
    return window.location.search.includes('antrag') || window.location.search.includes('form');
  });
  const [settings, setSettings] = useState<ClubSettings>({
    clubName: 'TSV Musterstadt 1890 e.V.',
    associationNumber: 'VR 48219 Amtsgericht Musterstadt',
    taxNumber: '112/5840/1922',
    creditorId: 'DE98ZZZ09999999999',
    address: 'Sportplatzweg 12, 12345 Musterstadt',
    chairman: 'Dr. Michael Sommer',
    treasurer: 'Sabine Weber',
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

  const [receiptScannerOpen, setReceiptScannerOpen] = useState(false);
  const [scannerTargetTx, setScannerTargetTx] = useState<Transaction | null>(null);

  const [inventoryFormOpen, setInventoryFormOpen] = useState(false);
  const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryItem | null>(null);

  const [bankImportOpen, setBankImportOpen] = useState(false);
  const [transactionImportOpen, setTransactionImportOpen] = useState(false);
  const [accountManageOpen, setAccountManageOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Calendar Event Modal State
  const [calendarEventModalOpen, setCalendarEventModalOpen] = useState(false);
  const [calendarCategories, setCalendarCategories] = useState<CalendarEventCategory[]>([]);

  // Document Management States
  const [newDocChoiceOpen, setNewDocChoiceOpen] = useState(false);
  const [docUploadOpen, setDocUploadOpen] = useState(false);
  const [docUploadCategory, setDocUploadCategory] = useState<DocumentCategory | undefined>(undefined);
  const [docUploadFolderId, setDocUploadFolderId] = useState<string | null>(null);
  const [docScannerOpen, setDocScannerOpen] = useState(false);
  const [docViewerItem, setDocViewerItem] = useState<ClubDocument | null>(null);
  const [docEditItem, setDocEditItem] = useState<ClubDocument | null>(null);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);

  // Submenu expansion states
  const [membersMenuOpen, setMembersMenuOpen] = useState(true);
  const [financeMenuOpen, setFinanceMenuOpen] = useState(true);

  const [activeReceipt, setActiveReceipt] = useState<{
    receipt: ReceiptAttachment;
    docNum: string;
    text: string;
  } | null>(null);

  // Load initial data from local IndexedDB
  const loadData = async () => {
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
        loadedTemplateSettings
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
        StorageService.getApplicationTemplateSettings()
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
      if (loadedTemplateSettings) {
        setApplicationSettings(loadedTemplateSettings);
      }
    } catch (err) {
      console.error('Failed to load local data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    AuthService.init().then(session => {
      setAuthSession(session);
    });

    const unsubscribe = AuthService.onAuthStateChanged(session => {
      setAuthSession(session);
    });

    const handleUserActivity = () => {
      AuthService.recordActivity();
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);

    loadData();

    return () => {
      unsubscribe();
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
    };
  }, []);

  // Compute Next Member Number & Next Doc Number
  const nextMemberNumber = `M-${String(members.length + 101).padStart(4, '0')}`;
  const nextDocNumber = `BE-${new Date().getFullYear()}-${String(transactions.length + 1).padStart(3, '0')}`;

  // Member CRUD handlers
  const handleSaveMember = async (memberData: Member) => {
    const isNew = !members.some(m => m.id === memberData.id);
    await StorageService.saveMember(memberData, isNew ? 'Mitglied neu angelegt' : 'Stammdaten aktualisiert');
    const updated = await StorageService.getMembers();
    setMembers(updated);
    setMemberFormOpen(false);
    setEditingMember(null);

    // If currently viewing in drawer, refresh drawer target
    if (detailsMember?.id === memberData.id) {
      setDetailsMember(memberData);
    }
  };

  const handleDeleteMember = async (id: string) => {
    await StorageService.deleteMember(id);
    const updated = await StorageService.getMembers();
    setMembers(updated);
    if (detailsMember?.id === id) {
      setDetailsMember(null);
    }
  };

  const handleBulkUpdateMembers = async (ids: string[], updates: MemberBulkUpdates) => {
    await StorageService.bulkUpdateMembers(ids, updates);
    const updated = await StorageService.getMembers();
    setMembers(updated);
    if (detailsMember && ids.includes(detailsMember.id)) {
      const refreshed = updated.find(m => m.id === detailsMember.id);
      if (refreshed) setDetailsMember(refreshed);
    }
  };

  const handleBulkDeleteMembers = async (ids: string[]) => {
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

  // Transaction CRUD handlers
  const handleSaveTransaction = async (txData: Transaction) => {
    await StorageService.saveTransaction(txData);
    const updated = await StorageService.getTransactions();
    setTransactions(updated);
    setTxFormOpen(false);
    setEditingTx(null);
  };

  const handleDeleteTransaction = async (id: string) => {
    await StorageService.deleteTransaction(id);
    const updated = await StorageService.getTransactions();
    setTransactions(updated);
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
    const updated = await StorageService.getTransactions();
    setTransactions(updated);
    setReceiptScannerOpen(false);
    setScannerTargetTx(null);
  };

  const handleScannerCreateTransactionWithReceipt = (receipt: ReceiptAttachment) => {
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

  const handleDeleteAccount = async (id: string) => {
    await StorageService.deleteAccount(id);
    const updated = await StorageService.getAccounts();
    setAccounts(updated);
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
    await StorageService.deleteInventoryItem(id);
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

  const handleBatchMoveDocuments = async (ids: string[], targetCategory: DocumentCategory) => {
    await StorageService.moveDocumentsToCategory(ids, targetCategory);
    const updated = await StorageService.getDocuments();
    setDocuments(updated);
    if (docViewerItem && ids.includes(docViewerItem.id)) {
      const refreshed = updated.find(d => d.id === docViewerItem.id);
      if (refreshed) setDocViewerItem(refreshed);
    }
  };

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
  const nextDonationReceiptNumber = `ZB-${new Date().getFullYear()}-${String(donations.length + 1).padStart(3, '0')}`;

  const handleSaveDonationReceipt = async (
    receipt: DonationReceipt,
    options: {
      autoArchiveDoc: boolean;
      autoCreateTx: boolean;
      targetAccountId?: string;
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

  const handleDeleteDonationReceipt = async (id: string) => {
    await StorageService.deleteDonationReceipt(id);
    const [updatedDonations, updatedDocs] = await Promise.all([
      StorageService.getDonations(),
      StorageService.getDocuments()
    ]);
    setDonations(updatedDonations);
    setDocuments(updatedDocs);
  };

  const handleEditDonationReceipt = (receipt: DonationReceipt) => {
    setEditingDonation(receipt);
    setDonationFormOpen(true);
  };

  const handleOpenCreateDonation = () => {
    setEditingDonation(null);
    setDonationFormOpen(true);
  };

  // Calendar Event Quick Action Handlers
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
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 text-center max-w-sm w-full space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-lg font-bold text-white">VereinsManager</h2>
          <p className="text-xs text-slate-400">
            Lade verschlüsselte lokale IndexedDB-Instanz...
          </p>
        </div>
      </div>
    );
  }

  // Auth Gate: If user is not authenticated, show Login Screen
  if (!authSession.isAuthenticated) {
    return (
      <>
        <LoginScreen
          settings={settings}
          deploymentMode={deploymentMode}
          onLoginSuccess={(user) => {
            setAuthSession({ user, isAuthenticated: true, loginTime: new Date().toISOString() });
            loadData();
          }}
          onOpenDeploymentHub={() => setDeploymentHubOpen(true)}
        />
        {deploymentHubOpen && (
          <DeploymentHubModal
            currentMode={deploymentMode}
            onModeChange={async (newMode) => {
              setDeploymentMode(newMode);
              await loadData();
            }}
            onDataReload={loadData}
            onClose={() => setDeploymentHubOpen(false)}
          />
        )}
      </>
    );
  }

  const currentUser = authSession.user;
  const userPermissions = currentUser?.permissions || {
    canViewMembers: true,
    canEditMembers: true,
    canViewFinances: true,
    canEditFinances: true,
    canExecuteSepa: true,
    canManageDonations: true,
    canManageDocuments: true,
    canManageInventory: true,
    canManageSettings: true,
    canManageUsers: true
  };

  const canViewFinances = Boolean(userPermissions.canViewFinances);
  const canEditFinances = Boolean(userPermissions.canEditFinances);
  const canExecuteSepa = Boolean(userPermissions.canExecuteSepa);
  const canManageDonations = Boolean(userPermissions.canManageDonations);
  const canViewMembers = Boolean(userPermissions.canViewMembers);
  const canEditMembers = Boolean(userPermissions.canEditMembers);
  const canManageDocuments = Boolean(userPermissions.canManageDocuments);
  const canManageInventory = Boolean(userPermissions.canManageInventory);
  const canManageUsers = Boolean(userPermissions.canManageUsers);
  const canManageSettings = Boolean(userPermissions.canManageSettings);
  const isReadOnly = !canEditFinances && !canEditMembers;

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
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-600/30 border border-blue-400/30 shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
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
          {/* 1. Dashboard (Primary first menu item) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('dashboard');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-blue-400" />
              <span>Dashboard</span>
            </div>
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                activeTab === 'dashboard'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              Übersicht
            </span>
          </button>

          {/* 2. Mitglieder (Group with Sub-items) */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setMembersMenuOpen(!membersMenuOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span>Mitglieder</span>
              </div>
              {membersMenuOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
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
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'members'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>Mitgliederverwaltung</span>
                  </div>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
                      activeTab === 'members'
                        ? 'bg-blue-500/80 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {members.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('online_applications');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'online_applications'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
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
              type="button"
              onClick={() => setFinanceMenuOpen(!financeMenuOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Finanzen</span>
              </div>
              {financeMenuOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
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
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'finance'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Buchungen & Journal</span>
                  </div>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
                      activeTab === 'finance'
                        ? 'bg-blue-500/80 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {transactions.length}
                  </span>
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

                {/* 3d. Geld- & Sachzuwendungen (BMF Muster) */}
                <button
                  id="nav-btn-donations"
                  type="button"
                  onClick={() => {
                    setActiveTab('donations');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'donations'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <HeartHandshake className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Spenden</span>
                  </div>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
                      activeTab === 'donations'
                        ? 'bg-blue-500/80 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {donations.length}
                  </span>
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

          {/* 4. Kalender */}
          <div className="pt-2">
            <button
              id="nav-btn-calendar"
              type="button"
              onClick={() => {
                setActiveTab('calendar');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'calendar'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-indigo-400" />
                <span>Kalender</span>
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
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'inventory'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-400" />
                <span>Inventar</span>
              </div>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
                  activeTab === 'inventory'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {inventory.length}
              </span>
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
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'documents'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <FolderArchive className="w-4 h-4 text-amber-400" />
                <span>Dokumente</span>
              </div>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
                  activeTab === 'documents'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {documents.length}
              </span>
            </button>
          </div>
        </nav>

        {/* Sidebar Footer (Storage / DSGVO Status & Settings button) */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          {/* Cloud / Mode Switcher Quick Button */}
          <button
            type="button"
            onClick={() => {
              setDeploymentHubOpen(true);
              setMobileMenuOpen(false);
            }}
            className={`w-full p-2.5 rounded-xl text-left border transition-all flex items-center justify-between ${
              deploymentMode === 'cloud'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                : deploymentMode === 'selfhosted'
                ? 'bg-blue-950/60 border-blue-500/40 text-blue-300 hover:bg-blue-900/60'
                : 'bg-slate-800/90 border-slate-700/60 text-slate-300 hover:bg-slate-700/90'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg ${
                deploymentMode === 'cloud'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : deploymentMode === 'selfhosted'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}>
                {deploymentMode === 'cloud' ? (
                  <Cloud className="w-4 h-4" />
                ) : deploymentMode === 'selfhosted' ? (
                  <Server className="w-4 h-4" />
                ) : (
                  <HardDrive className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="text-[11px] font-bold leading-tight">
                  {deploymentMode === 'cloud'
                    ? 'Cloud (Supabase EU)'
                    : deploymentMode === 'selfhosted'
                    ? 'Docker Selbsthoster'
                    : 'Lokale IndexedDB'}
                </div>
                <div className="text-[9px] text-slate-400">
                  Modus wechseln & Setup
                </div>
              </div>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              Hub
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSettingsOpen(true);
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-colors border border-slate-700/60 shadow-2xs"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>Einstellungen & Sicherung</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Demo Mode Sandbox Notice */}
        {AuthService.isDemoMode() && (
          <div className="bg-amber-500/10 border-b border-amber-300/50 px-4 py-2 flex items-center justify-between text-xs text-amber-950 font-medium shrink-0">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="font-bold text-amber-900">Demo-Modus aktiv:</span>
              <span className="hidden md:inline text-amber-800">
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
                className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-2xs font-semibold transition-colors cursor-pointer"
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
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between shrink-0 z-20 gap-3">
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg lg:hidden"
              aria-label="Menü öffnen"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 leading-tight truncate">
                {activeTab === 'dashboard' && 'Vereins-Dashboard'}
                {activeTab === 'members' && 'Mitgliederverwaltung'}
                {activeTab === 'online_applications' && 'Mitgliedsanträge & Digitales Aufnahmewesen'}
                {activeTab === 'member_analytics' && 'Mitglieder-Statistiken & Demografie'}
                {activeTab === 'sepa' && 'Beitragslauf (SEPA-Lastschriften)'}
                {activeTab === 'finance' && 'Finanz- & Kassenverwaltung'}
                {activeTab === 'guv' && 'Einnahmen-Überschuss-Rechnung (EÜR / GuV)'}
                {activeTab === 'finance_analytics' && 'Finanzanalysen & Cashflow'}
                {activeTab === 'donations' && 'Geld- & Sachzuwendungen (BMF-Zuwendungsbestätigungen)'}
                {activeTab === 'calendar' && 'Kalender & Termine'}
                {activeTab === 'inventory' && 'Inventar- & Materialverwaltung'}
                {activeTab === 'documents' && 'Dokumentenverwaltung & Archiv'}
              </h2>
              <p className="text-2xs text-slate-400 font-medium hidden sm:block truncate">
                {settings.clubName}
              </p>
            </div>
          </div>

          {/* Right Header User & Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Read-Only Badge for Auditor */}
            {isReadOnly && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-medium">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Kassenprüfer (Nur Leserecht)</span>
              </div>
            )}

            {/* User Profile & Session Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-slate-800 truncate max-w-[120px] leading-tight">
                    {currentUser?.name || 'Benutzer'}
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
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
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-40 space-y-1 animate-in fade-in zoom-in-95 duration-100 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-2">
                      <div className="font-bold text-slate-900 truncate">{currentUser?.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">Login: {currentUser?.username}</div>
                      <div className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-semibold border bg-blue-50 text-blue-800 border-blue-200">
                        {currentUser?.customRoleName || (canManageUsers ? 'Administrator' : 'Benutzer')}
                      </div>
                    </div>

                    {canManageUsers && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setUserManageOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-left transition-colors"
                      >
                        <UserCog className="w-4 h-4 text-blue-600" />
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
                settings={settings}
                pendingApplicationsCount={onlineApplications.filter(a => a.status === 'pending').length}
                onNavigate={(tab) => setActiveTab(tab)}
                onOpenCreateMember={() => {
                  setEditingMember(null);
                  setMemberFormOpen(true);
                }}
                onOpenCreateTx={() => {
                  setEditingTx(null);
                  setTxFormOpen(true);
                }}
                onOpenCreateEvent={handleOpenCreateCalendarEvent}
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

            {/* Tab: Online Membership Applications */}
            {activeTab === 'online_applications' && (
              <OnlineApplicationsView
                applications={onlineApplications}
                members={members}
                settings={settings}
                templateSettings={applicationSettings}
                currentUser={currentUser?.name || 'Vorstand'}
                onApproveApplication={async (appId, overrides, author) => {
                  const res = await StorageService.approveOnlineApplication(appId, overrides, author || currentUser?.name || 'Vorstand');
                  await loadData();
                  return res;
                }}
                onRejectApplication={async (appId, reason, author) => {
                  await StorageService.rejectOnlineApplication(appId, reason, author || currentUser?.name || 'Vorstand');
                  await loadData();
                }}
                onDeleteApplication={async (id) => {
                  await StorageService.deleteOnlineApplication(id);
                  await loadData();
                }}
                onSaveTemplateSettings={async (newSettings) => {
                  await StorageService.saveApplicationTemplateSettings(newSettings);
                  await loadData();
                }}
                onSubmitNewApplication={async (newApp) => {
                  await StorageService.saveOnlineApplication(newApp);
                  await loadData();
                }}
                onViewDocument={(doc) => setDocViewerItem(doc)}
                onOpenPublicForm={() => setIsPublicFormMode(true)}
                onNavigateToMembers={() => setActiveTab('members')}
                onNavigateToDocuments={() => setActiveTab('documents')}
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
                onOpenSettings={() => setSettingsOpen(true)}
                onRefreshData={loadData}
              />
            )}

            {/* Tab 3: Finance Management */}
            {activeTab === 'finance' && (
              <FinanceView
                transactions={transactions}
                accounts={accounts}
                settings={settings}
                onOpenCreateTx={() => {
                  setEditingTx(null);
                  setTxFormOpen(true);
                }}
                onOpenEditTx={(tx) => {
                  setEditingTx(tx);
                  setTxFormOpen(true);
                }}
                onDeleteTx={handleDeleteTransaction}
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
              />
            )}

            {/* Tab 4: GuV / EÜR Report (4 Tax Spheres) */}
            {activeTab === 'guv' && (
              <GuvReportView
                transactions={transactions}
                settings={settings}
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
                members={members}
                accounts={accounts}
                settings={settings}
                documents={documents}
                onOpenCreateModal={handleOpenCreateDonation}
                onEditReceipt={handleEditDonationReceipt}
                onDeleteReceipt={handleDeleteDonationReceipt}
                onViewDocument={(doc) => setDocViewerItem(doc)}
              />
            )}

            {/* Tab 6: Inventory Management */}
            {activeTab === 'inventory' && (
              <InventoryView
                inventory={inventory}
                departments={settings.departments}
                settings={settings}
                onOpenCreate={() => {
                  setEditingInventoryItem(null);
                  setInventoryFormOpen(true);
                }}
                onOpenEdit={(item) => {
                  setEditingInventoryItem(item);
                  setInventoryFormOpen(true);
                }}
                onDeleteItem={handleDeleteInventoryItem}
              />
            )}

            {/* Tab: Calendar & Events */}
            {activeTab === 'calendar' && (
              <CalendarView
                members={members}
                settings={settings}
                userPermissions={userPermissions}
              />
            )}

            {/* Tab 7: Documents Management */}
            {activeTab === 'documents' && (
              <DocumentsView
                documents={documents}
                folders={folders}
                members={members}
                transactions={transactions}
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
                onBatchMove={handleBatchMoveDocuments}
                onSaveFolder={handleSaveFolder}
                onDeleteFolder={handleDeleteFolder}
                onBatchMoveToFolder={handleBatchMoveToFolder}
              />
            )}
          </div>
        </div>
      </main>

      {/* 5. Modals & Drawers */}

      {/* New Document Choice Dialog (Upload vs Scan) */}
      {newDocChoiceOpen && (
        <NewDocumentChoiceModal
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
          onDelete={(id) => {
            handleDeleteDocument(id);
            setDocViewerItem(null);
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
          existingInventory={inventory}
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
          onClose={() => setDetailsMember(null)}
          onDelete={handleDeleteMember}
          onSaveMember={handleSaveMember}
          onEdit={(m) => {
            setEditingMember(m);
            setMemberFormOpen(true);
          }}
        />
      )}

      {/* Transaction Create/Edit Modal */}
      {txFormOpen && (
        <TransactionFormModal
          transaction={editingTx}
          accounts={accounts}
          nextDocNumber={nextDocNumber}
          onSave={handleSaveTransaction}
          onClose={() => {
            setTxFormOpen(false);
            setEditingTx(null);
          }}
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

      {/* Settings & DSGVO Privacy Modal */}
      {settingsOpen && (
        <SettingsPrivacyModal
          settings={settings}
          onSaveSettings={handleSaveSettings}
          onDataReload={loadData}
          onOpenDeploymentHub={() => setDeploymentHubOpen(true)}
          onOpenUserManage={() => setUserManageOpen(true)}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Deployment & Cloud Hub Modal */}
      {deploymentHubOpen && (
        <DeploymentHubModal
          currentMode={deploymentMode}
          onModeChange={(mode) => setDeploymentMode(mode)}
          onDataReload={loadData}
          onClose={() => setDeploymentHubOpen(false)}
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
          clubSettingsAddress={settings.address}
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
                clubSettings={settings}
                templateSettings={applicationSettings}
                onSubmit={async (app) => {
                  await StorageService.saveOnlineApplication(app);
                  await loadData();
                  setIsPublicFormMode(false);
                }}
                onCancel={() => setIsPublicFormMode(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
