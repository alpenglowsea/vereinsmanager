import { getSupabaseClient } from './supabaseClient';
import {
  Member,
  Transaction,
  FinancialAccount,
  MemberAuditLog,
  ClubSettings,
  InventoryItem,
  SepaRunHistory
} from '../types';

// ==========================================
// MAPPERS: TypeScript (camelCase) <-> Supabase (snake_case)
// ==========================================

function mapMemberToDb(m: Member) {
  return {
    id: m.id,
    member_number: m.memberNumber,
    first_name: m.firstName,
    last_name: m.lastName,
    gender: m.gender || 'none',
    birth_date: m.birthDate || null,
    avatar_url: m.avatarUrl || null,
    address: m.address || {},
    phone: m.phone || '',
    email: m.email || '',
    entry_date: m.entryDate,
    exit_date: m.exitDate || null,
    status: m.status,
    department: m.department,
    membership_type: m.membershipType,
    fee_amount: Number(m.feeAmount) || 0,
    fee_period: m.feePeriod,
    payment_method: m.paymentMethod,
    bank_details: m.bankDetails || {},
    notes: m.notes || '',
    data_privacy_consent: Boolean(m.dataPrivacyConsent),
    created_at: m.createdAt || new Date().toISOString(),
    updated_at: m.updatedAt || new Date().toISOString()
  };
}

function mapMemberFromDb(row: any): Member {
  return {
    id: row.id,
    memberNumber: row.member_number,
    firstName: row.first_name,
    lastName: row.last_name,
    gender: row.gender || 'none',
    birthDate: row.birth_date || undefined,
    avatarUrl: row.avatar_url || undefined,
    address: row.address || { street: '', houseNumber: '', zip: '', city: '', country: 'Deutschland' },
    phone: row.phone || '',
    email: row.email || '',
    entryDate: row.entry_date,
    exitDate: row.exit_date || undefined,
    status: row.status || 'active',
    department: row.department,
    membershipType: row.membership_type || 'full',
    feeAmount: Number(row.fee_amount) || 0,
    feePeriod: row.fee_period || 'monthly',
    paymentMethod: row.payment_method || 'sepa',
    bankDetails: row.bank_details || {
      iban: '',
      bic: '',
      bankName: '',
      accountHolder: '',
      mandateDate: '',
      mandateReference: ''
    },
    notes: row.notes || '',
    dataPrivacyConsent: Boolean(row.data_privacy_consent),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTransactionToDb(t: Transaction) {
  return {
    id: t.id,
    date: t.date,
    amount: Number(t.amount) || 0,
    type: t.type,
    account_id: t.accountId,
    target_account_id: t.targetAccountId || null,
    document_number: t.documentNumber,
    booking_text: t.bookingText,
    partner: t.partner,
    sphere: t.sphere,
    main_category: t.mainCategory || null,
    sub_category: t.subCategory || null,
    skr_account: t.skrAccount || null,
    category: t.category,
    vat_rate: Number(t.vatRate) || 0,
    notes: t.notes || '',
    receipt: t.receipt || null,
    created_at: t.createdAt || new Date().toISOString(),
    updated_at: t.updatedAt || new Date().toISOString()
  };
}

function mapTransactionFromDb(row: any): Transaction {
  return {
    id: row.id,
    date: row.date,
    amount: Number(row.amount) || 0,
    type: row.type,
    accountId: row.account_id,
    targetAccountId: row.target_account_id || undefined,
    documentNumber: row.document_number,
    bookingText: row.booking_text,
    partner: row.partner,
    sphere: row.sphere,
    mainCategory: row.main_category || undefined,
    subCategory: row.sub_category || undefined,
    skrAccount: row.skr_account || undefined,
    category: row.category,
    vatRate: Number(row.vat_rate) as 0 | 7 | 19,
    notes: row.notes || undefined,
    receipt: row.receipt || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAccountToDb(a: FinancialAccount) {
  return {
    id: a.id,
    name: a.name,
    account_type: a.accountType,
    iban: a.iban || null,
    bic: a.bic || null,
    initial_balance: Number(a.initialBalance) || 0,
    color: a.color || 'emerald',
    description: a.description || '',
    created_at: a.createdAt || new Date().toISOString()
  };
}

function mapAccountFromDb(row: any): FinancialAccount {
  return {
    id: row.id,
    name: row.name,
    accountType: row.account_type,
    iban: row.iban || undefined,
    bic: row.bic || undefined,
    initialBalance: Number(row.initial_balance) || 0,
    color: row.color || 'emerald',
    description: row.description || undefined,
    createdAt: row.created_at
  };
}

function mapInventoryToDb(i: InventoryItem) {
  return {
    id: i.id,
    item_number: i.itemNumber,
    name: i.name,
    category: i.category,
    department: i.department,
    quantity: Number(i.quantity) || 1,
    unit: i.unit || 'Stk.',
    location: i.location || '',
    condition: i.condition || 'good',
    purchase_date: i.purchaseDate || null,
    purchase_price: i.purchasePrice !== undefined ? Number(i.purchasePrice) : null,
    current_value: i.currentValue !== undefined ? Number(i.currentValue) : null,
    supplier: i.supplier || '',
    responsible_person: i.responsiblePerson || '',
    assigned_to: i.assignedTo || '',
    serial_number: i.serialNumber || '',
    notes: i.notes || '',
    photo_url: i.photoUrl || null,
    last_checked_date: i.lastCheckedDate || null,
    next_inspection_date: i.nextInspectionDate || null,
    created_at: i.createdAt || new Date().toISOString(),
    updated_at: i.updatedAt || new Date().toISOString()
  };
}

function mapInventoryFromDb(row: any): InventoryItem {
  return {
    id: row.id,
    itemNumber: row.item_number,
    name: row.name,
    category: row.category,
    department: row.department,
    quantity: Number(row.quantity) || 1,
    unit: row.unit || 'Stk.',
    location: row.location || '',
    condition: row.condition || 'good',
    purchaseDate: row.purchase_date || undefined,
    purchasePrice: row.purchase_price !== null ? Number(row.purchase_price) : undefined,
    currentValue: row.current_value !== null ? Number(row.current_value) : undefined,
    supplier: row.supplier || undefined,
    responsiblePerson: row.responsible_person || undefined,
    assignedTo: row.assigned_to || undefined,
    serialNumber: row.serial_number || undefined,
    notes: row.notes || undefined,
    photoUrl: row.photo_url || undefined,
    lastCheckedDate: row.last_checked_date || undefined,
    nextInspectionDate: row.next_inspection_date || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSepaRunToDb(r: SepaRunHistory) {
  return {
    id: r.id,
    title: r.title,
    execution_date: r.executionDate,
    created_at: r.createdAt || new Date().toISOString(),
    total_amount: Number(r.totalAmount) || 0,
    total_transactions: Number(r.totalTransactions) || 0,
    period_filter: r.periodFilter,
    target_year: Number(r.targetYear),
    target_month: r.targetMonth !== undefined ? Number(r.targetMonth) : null,
    booked_to_account_id: r.bookedToAccountId || null,
    is_booked: Boolean(r.isBooked),
    xml_content: r.xmlContent || null,
    items: r.items || []
  };
}

function mapSepaRunFromDb(row: any): SepaRunHistory {
  return {
    id: row.id,
    title: row.title,
    executionDate: row.execution_date,
    createdAt: row.created_at,
    totalAmount: Number(row.total_amount) || 0,
    totalTransactions: Number(row.total_transactions) || 0,
    periodFilter: row.period_filter,
    targetYear: Number(row.target_year),
    targetMonth: row.target_month !== null ? Number(row.target_month) : undefined,
    bookedToAccountId: row.booked_to_account_id || undefined,
    isBooked: Boolean(row.is_booked),
    xmlContent: row.xml_content || undefined,
    items: row.items || []
  };
}

function mapAuditLogToDb(l: MemberAuditLog) {
  return {
    id: l.id,
    member_id: l.memberId,
    member_number: l.memberNumber,
    member_name: l.memberName,
    timestamp: l.timestamp || new Date().toISOString(),
    author: l.author,
    action: l.action,
    summary: l.summary,
    changes: l.changes || []
  };
}

function mapAuditLogFromDb(row: any): MemberAuditLog {
  return {
    id: row.id,
    memberId: row.member_id,
    memberNumber: row.member_number,
    memberName: row.member_name,
    timestamp: row.timestamp,
    author: row.author,
    action: row.action,
    summary: row.summary,
    changes: row.changes || []
  };
}

// ==========================================
// CLOUD STORAGE SERVICE (SUPABASE)
// ==========================================

export const CloudStorageService = {
  // Members
  async getMembers(): Promise<Member[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('members').select('*').order('created_at', { ascending: false });
    if (error) {
      console.warn('Supabase getMembers error:', error.message);
      return [];
    }
    return (data || []).map(mapMemberFromDb);
  },

  async getMember(id: string): Promise<Member | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('members').select('*').eq('id', id).single();
    if (error || !data) return null;
    return mapMemberFromDb(data);
  },

  async saveMember(member: Member): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapMemberToDb(member);
    const { error } = await client.from('members').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveMember Fehler: ${error.message}`);
  },

  async deleteMember(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('members').delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteMember Fehler: ${error.message}`);
  },

  async batchSaveMembers(members: Member[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client || members.length === 0) return;
    const payloads = members.map(mapMemberToDb);
    const { error } = await client.from('members').upsert(payloads, { onConflict: 'id' });
    if (error) throw new Error(`Supabase batchSaveMembers Fehler: ${error.message}`);
  },

  // Accounts
  async getAccounts(): Promise<FinancialAccount[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('accounts').select('*').order('created_at', { ascending: true });
    if (error) {
      console.warn('Supabase getAccounts error:', error.message);
      return [];
    }
    return (data || []).map(mapAccountFromDb);
  },

  async saveAccount(account: FinancialAccount): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapAccountToDb(account);
    const { error } = await client.from('accounts').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveAccount Fehler: ${error.message}`);
  },

  async deleteAccount(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('accounts').delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteAccount Fehler: ${error.message}`);
  },

  async batchSaveAccounts(accounts: FinancialAccount[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client || accounts.length === 0) return;
    const payloads = accounts.map(mapAccountToDb);
    const { error } = await client.from('accounts').upsert(payloads, { onConflict: 'id' });
    if (error) throw new Error(`Supabase batchSaveAccounts Fehler: ${error.message}`);
  },

  // Transactions
  async getTransactions(): Promise<Transaction[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('transactions').select('*').order('date', { ascending: false });
    if (error) {
      console.warn('Supabase getTransactions error:', error.message);
      return [];
    }
    return (data || []).map(mapTransactionFromDb);
  },

  async saveTransaction(tx: Transaction): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapTransactionToDb(tx);
    const { error } = await client.from('transactions').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveTransaction Fehler: ${error.message}`);
  },

  async batchSaveTransactions(txs: Transaction[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client || txs.length === 0) return;
    const payloads = txs.map(mapTransactionToDb);
    const { error } = await client.from('transactions').upsert(payloads, { onConflict: 'id' });
    if (error) throw new Error(`Supabase batchSaveTransactions Fehler: ${error.message}`);
  },

  async deleteTransaction(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('transactions').delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteTransaction Fehler: ${error.message}`);
  },

  // Inventory
  async getInventory(): Promise<InventoryItem[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('inventory').select('*').order('created_at', { ascending: false });
    if (error) {
      console.warn('Supabase getInventory error:', error.message);
      return [];
    }
    return (data || []).map(mapInventoryFromDb);
  },

  async saveInventoryItem(item: InventoryItem): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapInventoryToDb(item);
    const { error } = await client.from('inventory').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveInventoryItem Fehler: ${error.message}`);
  },

  async batchSaveInventory(items: InventoryItem[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client || items.length === 0) return;
    const payloads = items.map(mapInventoryToDb);
    const { error } = await client.from('inventory').upsert(payloads, { onConflict: 'id' });
    if (error) throw new Error(`Supabase batchSaveInventory Fehler: ${error.message}`);
  },

  async deleteInventoryItem(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('inventory').delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteInventoryItem Fehler: ${error.message}`);
  },

  // Settings
  async getSettings(): Promise<ClubSettings | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('settings').select('*').eq('id', 'main').single();
    if (error || !data) return null;

    return {
      clubName: data.club_name,
      associationNumber: data.association_number || '',
      taxNumber: data.tax_number || '',
      creditorId: data.creditor_id || '',
      creditorIban: data.creditor_iban || undefined,
      creditorBic: data.creditor_bic || undefined,
      creditorAccountId: data.creditor_account_id || undefined,
      address: data.address || '',
      chairman: data.chairman || '',
      treasurer: data.treasurer || '',
      email: data.email || '',
      departments: data.departments || []
    };
  },

  async saveSettings(settings: ClubSettings): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = {
      id: 'main',
      club_name: settings.clubName,
      association_number: settings.associationNumber,
      tax_number: settings.taxNumber,
      creditor_id: settings.creditorId,
      creditor_iban: settings.creditorIban || null,
      creditor_bic: settings.creditorBic || null,
      creditor_account_id: settings.creditorAccountId || null,
      address: settings.address,
      chairman: settings.chairman,
      treasurer: settings.treasurer,
      email: settings.email,
      departments: settings.departments,
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from('settings').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveSettings Fehler: ${error.message}`);
  },

  // SEPA Runs
  async getSepaRuns(): Promise<SepaRunHistory[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('sepa_runs').select('*').order('created_at', { ascending: false });
    if (error) {
      console.warn('Supabase getSepaRuns error:', error.message);
      return [];
    }
    return (data || []).map(mapSepaRunFromDb);
  },

  async saveSepaRun(run: SepaRunHistory): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapSepaRunToDb(run);
    const { error } = await client.from('sepa_runs').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveSepaRun Fehler: ${error.message}`);
  },

  async deleteSepaRun(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('sepa_runs').delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteSepaRun Fehler: ${error.message}`);
  },

  // Audit Logs
  async getAuditLogs(): Promise<MemberAuditLog[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('audit_logs').select('*').order('timestamp', { ascending: false });
    if (error) {
      console.warn('Supabase getAuditLogs error:', error.message);
      return [];
    }
    return (data || []).map(mapAuditLogFromDb);
  },

  async saveAuditLog(log: MemberAuditLog): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapAuditLogToDb(log);
    const { error } = await client.from('audit_logs').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveAuditLog Fehler: ${error.message}`);
  }
};
