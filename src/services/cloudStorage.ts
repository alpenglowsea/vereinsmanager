import { getSupabaseClient } from './supabaseClient';
import {
  Member,
  Transaction,
  FinancialAccount,
  MemberAuditLog,
  ClubSettings,
  InventoryItem,
  SepaRunHistory,
  ClubContact,
  ClubInvoice,
  InvoiceTemplateSettings,
  Meeting,
  MeetingTemplateSettings,
  DonationReceipt,
  CalendarEvent,
  CalendarEventCategory,
  ClubDocument,
  DocumentFolder,
  OnlineMembershipApplication,
  ApplicationTemplateSettings
} from '../types';
import { UserDashboardConfig } from '../types/dashboard';

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

function mapContactToDb(c: ClubContact) {
  return {
    id: c.id,
    contact_number: c.contactNumber,
    person_type: c.personType,
    types: c.types || [],
    company_name: c.companyName || null,
    legal_form: c.legalForm || null,
    contact_person: c.contactPerson || null,
    tax_id: c.taxId || null,
    commercial_register: c.commercialRegister || null,
    salutation: c.salutation || null,
    first_name: c.firstName || null,
    last_name: c.lastName || null,
    date_of_birth: c.dateOfBirth || null,
    display_name: c.displayName,
    address: c.address || {},
    email: c.email || '',
    phone: c.phone || '',
    mobile: c.mobile || null,
    website: c.website || null,
    bank_details: c.bankDetails || {},
    creditor_or_debtor_number: c.creditorOrDebtorNumber || null,
    notes: c.notes || null,
    tags: c.tags || [],
    created_at: c.createdAt || new Date().toISOString(),
    updated_at: c.updatedAt || new Date().toISOString()
  };
}

function mapContactFromDb(row: any): ClubContact {
  return {
    id: row.id,
    contactNumber: row.contact_number,
    personType: row.person_type || 'legal',
    types: row.types || ['supplier'],
    companyName: row.company_name || undefined,
    legalForm: row.legal_form || undefined,
    contactPerson: row.contact_person || undefined,
    taxId: row.tax_id || undefined,
    commercialRegister: row.commercial_register || undefined,
    salutation: row.salutation || undefined,
    firstName: row.first_name || undefined,
    lastName: row.last_name || undefined,
    dateOfBirth: row.date_of_birth || undefined,
    displayName: row.display_name,
    address: row.address || { street: '', houseNumber: '', zip: '', city: '', country: 'Deutschland' },
    email: row.email || '',
    phone: row.phone || '',
    mobile: row.mobile || undefined,
    website: row.website || undefined,
    bankDetails: row.bank_details || undefined,
    creditorOrDebtorNumber: row.creditor_or_debtor_number || undefined,
    notes: row.notes || undefined,
    tags: row.tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInvoiceToDb(i: ClubInvoice) {
  return {
    id: i.id,
    invoice_number: i.invoiceNumber,
    date: i.date,
    delivery_date: i.deliveryDate || null,
    due_date: i.dueDate,
    status: i.status,
    recipient_type: i.recipientType,
    recipient_id: i.recipientId || null,
    recipient_name: i.recipientName,
    recipient_company: i.recipientCompany || null,
    recipient_contact_person: i.recipientContactPerson || null,
    recipient_address: i.recipientAddress || {},
    recipient_email: i.recipientEmail || null,
    recipient_phone: i.recipientPhone || null,
    title: i.title,
    subject: i.subject,
    intro_text: i.introText || null,
    items: i.items || [],
    outro_text: i.outroText || null,
    tax_sphere: i.taxSphere || null,
    subtotal_net: Number(i.subtotalNet) || 0,
    vat_amounts: i.vatAmounts || {},
    total_vat: Number(i.totalVat) || 0,
    total_amount: Number(i.totalAmount) || 0,
    payment_terms_days: Number(i.paymentTermsDays) || 14,
    paid_at: i.paidAt || null,
    payment_method: i.paymentMethod || null,
    linked_transaction_id: i.linkedTransactionId || null,
    document_id: i.documentId || null,
    custom_template_used: Boolean(i.customTemplateUsed),
    notes: i.notes || null,
    created_at: i.createdAt || new Date().toISOString(),
    updated_at: i.updatedAt || new Date().toISOString()
  };
}

function mapInvoiceFromDb(row: any): ClubInvoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    date: row.date,
    deliveryDate: row.delivery_date || undefined,
    dueDate: row.due_date,
    status: row.status,
    recipientType: row.recipient_type || 'member',
    recipientId: row.recipient_id || undefined,
    recipientName: row.recipient_name,
    recipientCompany: row.recipient_company || undefined,
    recipientContactPerson: row.recipient_contact_person || undefined,
    recipientAddress: row.recipient_address || { street: '', houseNumber: '', zip: '', city: '', country: 'Deutschland' },
    recipientEmail: row.recipient_email || undefined,
    recipientPhone: row.recipient_phone || undefined,
    title: row.title,
    subject: row.subject,
    introText: row.intro_text || undefined,
    items: row.items || [],
    outroText: row.outro_text || undefined,
    taxSphere: row.tax_sphere || undefined,
    subtotalNet: Number(row.subtotal_net) || 0,
    vatAmounts: row.vat_amounts || {},
    totalVat: Number(row.total_vat) || 0,
    totalAmount: Number(row.total_amount) || 0,
    paymentTermsDays: Number(row.payment_terms_days) || 14,
    paidAt: row.paid_at || undefined,
    paymentMethod: row.payment_method || undefined,
    linkedTransactionId: row.linked_transaction_id || undefined,
    documentId: row.document_id || undefined,
    customTemplateUsed: Boolean(row.custom_template_used),
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInvoiceTemplateToDb(t: InvoiceTemplateSettings) {
  return {
    id: 'main_template',
    template_name: t.templateName || 'Standard Vereinsbriefbogen DIN 5008',
    custom_blanko_data_url: t.customBlankoDataUrl || null,
    custom_blanko_file_name: t.customBlankoFileName || null,
    custom_blanko_uploaded_at: t.customBlankoUploadedAt || null,
    margin_top: Number(t.marginTop) || 25,
    margin_bottom: Number(t.marginBottom) || 20,
    margin_left: Number(t.marginLeft) || 25,
    margin_right: Number(t.marginRight) || 20,
    default_intro_text: t.defaultIntroText || null,
    default_outro_text: t.defaultOutroText || null,
    default_payment_terms_days: Number(t.defaultPaymentTermsDays) || 14,
    default_due_notice: t.defaultDueNotice || null,
    show_club_logo: t.showClubLogo !== false,
    show_folding_marks: t.showFoldingMarks !== false,
    show_giro_code: t.showGiroCode !== false,
    accent_color: t.accentColor || '#1e3a8a',
    updated_at: new Date().toISOString()
  };
}

function mapInvoiceTemplateFromDb(row: any): InvoiceTemplateSettings {
  return {
    id: row.id,
    templateName: row.template_name,
    customBlankoDataUrl: row.custom_blanko_data_url || undefined,
    customBlankoFileName: row.custom_blanko_file_name || undefined,
    customBlankoUploadedAt: row.custom_blanko_uploaded_at || undefined,
    marginTop: Number(row.margin_top) || 25,
    marginBottom: Number(row.margin_bottom) || 20,
    marginLeft: Number(row.margin_left) || 25,
    marginRight: Number(row.margin_right) || 20,
    defaultIntroText: row.default_intro_text || '',
    defaultOutroText: row.default_outro_text || '',
    defaultPaymentTermsDays: Number(row.default_payment_terms_days) || 14,
    defaultDueNotice: row.default_due_notice || '',
    showClubLogo: row.show_club_logo !== false,
    showFoldingMarks: row.show_folding_marks !== false,
    showGiroCode: row.show_giro_code !== false,
    accentColor: row.accent_color || '#1e3a8a'
  };
}

function mapMeetingToDb(m: Meeting) {
  return {
    id: m.id,
    title: m.title,
    type: m.type,
    status: m.status,
    protocol_type: m.protocolType,
    date: m.date,
    start_time: m.startTime,
    end_time: m.endTime || null,
    location: m.location,
    chairperson: m.chairperson,
    minute_keeper: m.minuteKeeper,
    invitation_date: m.invitationDate || null,
    invitation_method: m.invitationMethod || null,
    invitation_compliant: Boolean(m.invitationCompliant),
    quorum_confirmed: Boolean(m.quorumConfirmed),
    total_eligible_voters: m.totalEligibleVoters !== undefined ? Number(m.totalEligibleVoters) : null,
    agenda: m.agenda || [],
    attendees: m.attendees || [],
    general_notes: m.generalNotes || null,
    custom_template_used: Boolean(m.customTemplateUsed),
    signed_at: m.signedAt || null,
    signatures: m.signatures || [],
    document_id: m.documentId || null,
    created_at: m.createdAt || new Date().toISOString(),
    updated_at: m.updatedAt || new Date().toISOString()
  };
}

function mapMeetingFromDb(row: any): Meeting {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status,
    protocolType: row.protocol_type,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time || undefined,
    location: row.location,
    chairperson: row.chairperson,
    minuteKeeper: row.minute_keeper,
    invitationDate: row.invitation_date || undefined,
    invitationMethod: row.invitation_method || undefined,
    invitationCompliant: Boolean(row.invitation_compliant),
    quorumConfirmed: Boolean(row.quorum_confirmed),
    totalEligibleVoters: row.total_eligible_voters !== null && row.total_eligible_voters !== undefined ? Number(row.total_eligible_voters) : undefined,
    agenda: row.agenda || [],
    attendees: row.attendees || [],
    generalNotes: row.general_notes || undefined,
    customTemplateUsed: Boolean(row.custom_template_used),
    signedAt: row.signed_at || undefined,
    signatures: row.signatures || [],
    documentId: row.document_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMeetingTemplateToDb(t: MeetingTemplateSettings) {
  return {
    id: 'main_meeting_template',
    template_name: t.templateName || 'Standard Sitzungsprotokoll BGB § 32',
    custom_blanko_data_url: t.customBlankoDataUrl || null,
    custom_blanko_file_name: t.customBlankoFileName || null,
    custom_blanko_uploaded_at: t.customBlankoUploadedAt || null,
    margin_top: Number(t.marginTop) || 25,
    margin_bottom: Number(t.marginBottom) || 20,
    margin_left: Number(t.marginLeft) || 20,
    margin_right: Number(t.marginRight) || 20,
    show_club_header: t.showClubHeader !== false,
    show_club_logo: t.showClubLogo !== false,
    show_signatures_block: t.showSignaturesBlock !== false,
    show_register_extract_notice: t.showRegisterExtractNotice !== false,
    accent_color: t.accentColor || '#e11d48',
    updated_at: new Date().toISOString()
  };
}

function mapMeetingTemplateFromDb(row: any): MeetingTemplateSettings {
  return {
    id: row.id,
    templateName: row.template_name,
    customBlankoDataUrl: row.custom_blanko_data_url || undefined,
    customBlankoFileName: row.custom_blanko_file_name || undefined,
    customBlankoUploadedAt: row.custom_blanko_uploaded_at || undefined,
    marginTop: Number(row.margin_top) || 25,
    marginBottom: Number(row.margin_bottom) || 20,
    marginLeft: Number(row.margin_left) || 20,
    marginRight: Number(row.margin_right) || 20,
    showClubHeader: row.show_club_header !== false,
    showClubLogo: row.show_club_logo !== false,
    showSignaturesBlock: row.show_signatures_block !== false,
    showRegisterExtractNotice: row.show_register_extract_notice !== false,
    accentColor: row.accent_color || '#e11d48'
  };
}

function mapDonationToDb(d: DonationReceipt) {
  return {
    id: d.id,
    receipt_number: d.receiptNumber,
    type: d.type,
    date: d.date,
    donor_type: d.donorType,
    member_id: d.memberId || null,
    donor_name: d.donorName,
    donor_address: d.donorAddress || {},
    amount: Number(d.amount) || 0,
    amount_in_words: d.amountInWords,
    is_waiver_of_refund: Boolean(d.isWaiverOfRefund),
    goods_description: d.goodsDescription || null,
    goods_origin: d.goodsOrigin || null,
    goods_valuation_basis: d.goodsValuationBasis || null,
    tax_office: d.taxOffice,
    tax_number: d.taxNumber,
    exemption_date: d.exemptionDate,
    assessment_period: d.assessmentPeriod,
    promoted_purpose: d.promotedPurpose,
    is_directly_promoted: d.isDirectlyPromoted !== false,
    issued_by: d.issuedBy,
    city_and_date: d.cityAndDate,
    transaction_id: d.transactionId || null,
    document_id: d.documentId || null,
    notes: d.notes || null,
    created_at: d.createdAt || new Date().toISOString(),
    updated_at: d.updatedAt || new Date().toISOString()
  };
}

function mapDonationFromDb(row: any): DonationReceipt {
  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    type: row.type,
    date: row.date,
    donorType: row.donor_type,
    memberId: row.member_id || undefined,
    donorName: row.donor_name,
    donorAddress: row.donor_address || { street: '', houseNumber: '', zip: '', city: '', country: 'Deutschland' },
    amount: Number(row.amount) || 0,
    amountInWords: row.amount_in_words,
    isWaiverOfRefund: Boolean(row.is_waiver_of_refund),
    goodsDescription: row.goods_description || undefined,
    goodsOrigin: row.goods_origin || undefined,
    goodsValuationBasis: row.goods_valuation_basis || undefined,
    taxOffice: row.tax_office,
    taxNumber: row.tax_number,
    exemptionDate: row.exemption_date,
    assessmentPeriod: row.assessment_period,
    promotedPurpose: row.promoted_purpose,
    isDirectlyPromoted: Boolean(row.is_directly_promoted),
    issuedBy: row.issued_by,
    cityAndDate: row.city_and_date,
    transactionId: row.transaction_id || undefined,
    documentId: row.document_id || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCalendarEventToDb(e: CalendarEvent) {
  return {
    id: e.id,
    title: e.title,
    description: e.description || null,
    category_id: e.categoryId,
    department: e.department || null,
    start_date: e.startDate,
    start_time: e.startTime || null,
    end_date: e.endDate,
    end_time: e.endTime || null,
    is_all_day: Boolean(e.isAllDay),
    location: e.location || null,
    location_lat: e.locationLat || null,
    location_lng: e.locationLng || null,
    recurrence: e.recurrence || null,
    participants: e.participants || [],
    max_participants: e.maxParticipants !== undefined ? Number(e.maxParticipants) : null,
    color: e.color || null,
    created_by_id: e.createdById || null,
    created_at: e.createdAt || new Date().toISOString(),
    updated_at: e.updatedAt || new Date().toISOString()
  };
}

function mapCalendarEventFromDb(row: any): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    categoryId: row.category_id,
    department: row.department || undefined,
    startDate: row.start_date,
    startTime: row.start_time || undefined,
    endDate: row.end_date,
    endTime: row.end_time || undefined,
    isAllDay: Boolean(row.is_all_day),
    location: row.location || undefined,
    locationLat: row.location_lat ? Number(row.location_lat) : undefined,
    locationLng: row.location_lng ? Number(row.location_lng) : undefined,
    recurrence: row.recurrence || undefined,
    participants: row.participants || [],
    maxParticipants: row.max_participants ? Number(row.max_participants) : undefined,
    color: row.color || undefined,
    createdById: row.created_by_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCalendarCategoryToDb(c: CalendarEventCategory) {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    badge_bg: c.badgeBg,
    badge_text: c.badgeText,
    badge_border: c.badgeBorder,
    icon: c.icon || null,
    description: c.description || null,
    is_system: Boolean(c.isSystem)
  };
}

function mapCalendarCategoryFromDb(row: any): CalendarEventCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    badgeBg: row.badge_bg,
    badgeText: row.badge_text,
    badgeBorder: row.badge_border,
    icon: row.icon || undefined,
    description: row.description || undefined,
    isSystem: Boolean(row.is_system)
  };
}

function mapDocumentToDb(d: ClubDocument) {
  return {
    id: d.id,
    title: d.title,
    file_name: d.fileName,
    file_type: d.fileType,
    file_size: Number(d.fileSize) || 0,
    data_url: d.dataUrl,
    category: d.category,
    folder_id: d.folderId || null,
    date: d.date,
    upload_date: d.uploadDate || new Date().toISOString(),
    tags: d.tags || [],
    notes: d.notes || null,
    transaction_id: d.transactionId || null,
    transaction_doc_number: d.transactionDocNumber || null,
    member_id: d.memberId || null,
    member_name: d.memberName || null,
    is_receipt: Boolean(d.isReceipt),
    created_at: d.createdAt || new Date().toISOString(),
    updated_at: d.updatedAt || new Date().toISOString()
  };
}

function mapDocumentFromDb(row: any): ClubDocument {
  return {
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: Number(row.file_size) || 0,
    dataUrl: row.data_url,
    category: row.category,
    folderId: row.folder_id || undefined,
    date: row.date,
    uploadDate: row.upload_date,
    tags: row.tags || [],
    notes: row.notes || undefined,
    transactionId: row.transaction_id || undefined,
    transactionDocNumber: row.transaction_doc_number || undefined,
    memberId: row.member_id || undefined,
    memberName: row.member_name || undefined,
    isReceipt: Boolean(row.is_receipt),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapFolderToDb(f: DocumentFolder) {
  return {
    id: f.id,
    name: f.name,
    parent_id: f.parentId || null,
    category: f.category || null,
    color: f.color || null,
    icon: f.icon || null,
    description: f.description || null,
    created_at: f.createdAt || new Date().toISOString(),
    updated_at: f.updatedAt || new Date().toISOString()
  };
}

function mapFolderFromDb(row: any): DocumentFolder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id || undefined,
    category: row.category || undefined,
    color: row.color || undefined,
    icon: row.icon || undefined,
    description: row.description || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapOnlineAppToDb(a: OnlineMembershipApplication) {
  return {
    id: a.id,
    application_number: a.applicationNumber,
    submitted_at: a.submittedAt || new Date().toISOString(),
    status: a.status,
    reviewed_at: a.reviewedAt || null,
    reviewed_by: a.reviewedBy || null,
    rejection_reason: a.rejectionReason || null,
    created_member_id: a.createdMemberId || null,
    created_member_number: a.createdMemberNumber || null,
    generated_document_id: a.generatedDocumentId || null,
    first_name: a.firstName,
    last_name: a.lastName,
    gender: a.gender,
    birth_date: a.birthDate,
    nationality: a.nationality || null,
    phone: a.phone,
    email: a.email,
    address: a.address || {},
    department: a.department,
    membership_type: a.membershipType,
    fee_amount: a.feeAmount !== undefined ? Number(a.feeAmount) : null,
    fee_period: a.feePeriod,
    entry_date: a.entryDate,
    notes: a.notes || null,
    previous_club: a.previousClub || null,
    is_minor: Boolean(a.isMinor),
    guardian_name: a.guardianName || null,
    guardian_phone: a.guardianPhone || null,
    guardian_email: a.guardianEmail || null,
    guardian_address: a.guardianAddress || null,
    guardian_relation: a.guardianRelation || null,
    payment_method: a.paymentMethod,
    bank_details: a.bankDetails || {},
    data_privacy_consent: Boolean(a.dataPrivacyConsent),
    statute_consent: Boolean(a.statuteConsent),
    photo_consent: Boolean(a.photoConsent),
    health_confirmation: Boolean(a.healthConfirmation),
    applicant_signature: a.applicantSignature || null,
    applicant_signature_date: a.applicantSignatureDate || null,
    guardian_signature: a.guardianSignature || null,
    guardian_signature_date: a.guardianSignatureDate || null,
    sepa_signature: a.sepaSignature || null,
    sepa_signature_date: a.sepaSignatureDate || null,
    pdf_data_url: a.pdfDataUrl || null,
    custom_template_used: Boolean(a.customTemplateUsed)
  };
}

function mapOnlineAppFromDb(row: any): OnlineMembershipApplication {
  return {
    id: row.id,
    applicationNumber: row.application_number,
    submittedAt: row.submitted_at,
    status: row.status,
    reviewedAt: row.reviewed_at || undefined,
    reviewedBy: row.reviewed_by || undefined,
    rejectionReason: row.rejection_reason || undefined,
    createdMemberId: row.created_member_id || undefined,
    createdMemberNumber: row.created_member_number || undefined,
    generatedDocumentId: row.generated_document_id || undefined,
    firstName: row.first_name,
    lastName: row.last_name,
    gender: row.gender,
    birthDate: row.birth_date,
    nationality: row.nationality || undefined,
    phone: row.phone,
    email: row.email,
    address: row.address || { street: '', houseNumber: '', zip: '', city: '', country: 'Deutschland' },
    department: row.department,
    membershipType: row.membership_type,
    feeAmount: row.fee_amount !== null && row.fee_amount !== undefined ? Number(row.fee_amount) : undefined,
    feePeriod: row.fee_period,
    entryDate: row.entry_date,
    notes: row.notes || undefined,
    previousClub: row.previous_club || undefined,
    isMinor: Boolean(row.is_minor),
    guardianName: row.guardian_name || undefined,
    guardianPhone: row.guardian_phone || undefined,
    guardianEmail: row.guardian_email || undefined,
    guardianAddress: row.guardian_address || undefined,
    guardianRelation: row.guardian_relation || undefined,
    paymentMethod: row.payment_method,
    bankDetails: row.bank_details || { iban: '', bic: '', bankName: '', accountHolder: '', mandateDate: '', mandateReference: '' },
    dataPrivacyConsent: Boolean(row.data_privacy_consent),
    statuteConsent: Boolean(row.statute_consent),
    photoConsent: Boolean(row.photo_consent),
    healthConfirmation: Boolean(row.health_confirmation),
    applicantSignature: row.applicant_signature || undefined,
    applicantSignatureDate: row.applicant_signature_date || undefined,
    guardianSignature: row.guardian_signature || undefined,
    guardianSignatureDate: row.guardian_signature_date || undefined,
    sepaSignature: row.sepa_signature || undefined,
    sepaSignatureDate: row.sepa_signature_date || undefined,
    pdfDataUrl: row.pdf_data_url || undefined,
    customTemplateUsed: Boolean(row.custom_template_used)
  };
}

function mapApplicationSettingsToDb(s: ApplicationTemplateSettings) {
  return {
    id: 'main',
    club_logo_url: s.clubLogoUrl || null,
    header_text: s.headerText || null,
    custom_pdf_template_data_url: s.customPdfTemplateDataUrl || null,
    custom_pdf_template_file_name: s.customPdfTemplateFileName || null,
    custom_pdf_template_uploaded_at: s.customPdfTemplateUploadedAt || null,
    introductory_text: s.introductoryText || null,
    data_privacy_text: s.dataPrivacyText || null,
    statute_text: s.statuteText || null,
    default_fee_rules: s.defaultFeeRules || null,
    require_photo_consent: Boolean(s.requirePhotoConsent),
    require_health_confirmation: Boolean(s.requireHealthConfirmation),
    contact_email: s.contactEmail || null,
    notification_email: s.notificationEmail || null,
    updated_at: new Date().toISOString()
  };
}

function mapApplicationSettingsFromDb(row: any): ApplicationTemplateSettings {
  return {
    clubLogoUrl: row.club_logo_url || undefined,
    headerText: row.header_text || undefined,
    customPdfTemplateDataUrl: row.custom_pdf_template_data_url || undefined,
    customPdfTemplateFileName: row.custom_pdf_template_file_name || undefined,
    customPdfTemplateUploadedAt: row.custom_pdf_template_uploaded_at || undefined,
    introductoryText: row.introductory_text || undefined,
    dataPrivacyText: row.data_privacy_text || undefined,
    statuteText: row.statute_text || undefined,
    defaultFeeRules: row.default_fee_rules || undefined,
    requirePhotoConsent: Boolean(row.require_photo_consent),
    requireHealthConfirmation: Boolean(row.require_health_confirmation),
    contactEmail: row.contact_email || undefined,
    notificationEmail: row.notification_email || undefined
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
  },

  // Contacts
  async getContacts(): Promise<ClubContact[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('contacts').select('*').order('display_name', { ascending: true });
    if (error) {
      console.warn('Supabase getContacts error:', error.message);
      return [];
    }
    return (data || []).map(mapContactFromDb);
  },

  async getContact(id: string): Promise<ClubContact | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('contacts').select('*').eq('id', id).single();
    if (error || !data) return null;
    return mapContactFromDb(data);
  },

  async saveContact(contact: ClubContact): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapContactToDb(contact);
    const { error } = await client.from('contacts').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveContact Fehler: ${error.message}`);
  },

  async batchSaveContacts(contacts: ClubContact[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client || contacts.length === 0) return;
    const payloads = contacts.map(mapContactToDb);
    const { error } = await client.from('contacts').upsert(payloads, { onConflict: 'id' });
    if (error) throw new Error(`Supabase batchSaveContacts Fehler: ${error.message}`);
  },

  async deleteContact(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('contacts').delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteContact Fehler: ${error.message}`);
  },

  // Invoices
  async getInvoices(): Promise<ClubInvoice[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('invoices').select('*').order('date', { ascending: false });
    if (error) {
      console.warn('Supabase getInvoices error:', error.message);
      return [];
    }
    return (data || []).map(mapInvoiceFromDb);
  },

  async getInvoice(id: string): Promise<ClubInvoice | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('invoices').select('*').eq('id', id).single();
    if (error || !data) return null;
    return mapInvoiceFromDb(data);
  },

  async saveInvoice(invoice: ClubInvoice): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapInvoiceToDb(invoice);
    const { error } = await client.from('invoices').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveInvoice Fehler: ${error.message}`);
  },

  async batchSaveInvoices(invoices: ClubInvoice[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client || invoices.length === 0) return;
    const payloads = invoices.map(mapInvoiceToDb);
    const { error } = await client.from('invoices').upsert(payloads, { onConflict: 'id' });
    if (error) throw new Error(`Supabase batchSaveInvoices Fehler: ${error.message}`);
  },

  async deleteInvoice(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('invoices').delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteInvoice Fehler: ${error.message}`);
  },

  // Invoice Template Settings
  async getInvoiceTemplate(): Promise<InvoiceTemplateSettings | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('invoice_templates').select('*').eq('id', 'main_template').single();
    if (error || !data) return null;
    return mapInvoiceTemplateFromDb(data);
  },

  async saveInvoiceTemplate(settings: InvoiceTemplateSettings): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapInvoiceTemplateToDb(settings);
    const { error } = await client.from('invoice_templates').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveInvoiceTemplate Fehler: ${error.message}`);
  },

  // Meetings & Protocol
  async getMeetings(): Promise<Meeting[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('meetings').select('*').order('date', { ascending: false });
    if (error) {
      console.warn('Supabase getMeetings error:', error.message);
      return [];
    }
    return (data || []).map(mapMeetingFromDb);
  },

  async getMeeting(id: string): Promise<Meeting | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('meetings').select('*').eq('id', id).single();
    if (error || !data) return null;
    return mapMeetingFromDb(data);
  },

  async saveMeeting(meeting: Meeting): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapMeetingToDb(meeting);
    const { error } = await client.from('meetings').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveMeeting Fehler: ${error.message}`);
  },

  async batchSaveMeetings(meetings: Meeting[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client || meetings.length === 0) return;
    const payloads = meetings.map(mapMeetingToDb);
    const { error } = await client.from('meetings').upsert(payloads, { onConflict: 'id' });
    if (error) throw new Error(`Supabase batchSaveMeetings Fehler: ${error.message}`);
  },

  async deleteMeeting(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('meetings').delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteMeeting Fehler: ${error.message}`);
  },

  // Meeting Template Settings
  async getMeetingTemplate(): Promise<MeetingTemplateSettings | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('meeting_templates').select('*').eq('id', 'main_meeting_template').single();
    if (error || !data) return null;
    return mapMeetingTemplateFromDb(data);
  },

  async saveMeetingTemplate(settings: MeetingTemplateSettings): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapMeetingTemplateToDb(settings);
    const { error } = await client.from('meeting_templates').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveMeetingTemplate Fehler: ${error.message}`);
  },

  // Donations & Receipts
  async getDonations(): Promise<DonationReceipt[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('donations').select('*').order('date', { ascending: false });
    if (error) {
      console.warn('Supabase getDonations error:', error.message);
      return [];
    }
    return (data || []).map(mapDonationFromDb);
  },

  async getDonation(id: string): Promise<DonationReceipt | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('donations').select('*').eq('id', id).single();
    if (error || !data) return null;
    return mapDonationFromDb(data);
  },

  async saveDonation(donation: DonationReceipt): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapDonationToDb(donation);
    const { error } = await client.from('donations').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveDonation Fehler: ${error.message}`);
  },

  async batchSaveDonations(donations: DonationReceipt[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client || donations.length === 0) return;
    const payloads = donations.map(mapDonationToDb);
    const { error } = await client.from('donations').upsert(payloads, { onConflict: 'id' });
    if (error) throw new Error(`Supabase batchSaveDonations Fehler: ${error.message}`);
  },

  async deleteDonation(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('donations').delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteDonation Fehler: ${error.message}`);
  },

  // Calendar
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('calendar_events').select('*').order('start_date', { ascending: true });
    if (error) {
      console.warn('Supabase getCalendarEvents error:', error.message);
      return [];
    }
    return (data || []).map(mapCalendarEventFromDb);
  },

  async saveCalendarEvent(event: CalendarEvent): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapCalendarEventToDb(event);
    const { error } = await client.from('calendar_events').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveCalendarEvent Fehler: ${error.message}`);
  },

  async batchSaveCalendarEvents(events: CalendarEvent[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client || events.length === 0) return;
    const payloads = events.map(mapCalendarEventToDb);
    const { error } = await client.from('calendar_events').upsert(payloads, { onConflict: 'id' });
    if (error) throw new Error(`Supabase batchSaveCalendarEvents Fehler: ${error.message}`);
  },

  async deleteCalendarEvent(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('calendar_events').delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteCalendarEvent Fehler: ${error.message}`);
  },

  async getCalendarCategories(): Promise<CalendarEventCategory[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('calendar_categories').select('*').order('name', { ascending: true });
    if (error) {
      console.warn('Supabase getCalendarCategories error:', error.message);
      return [];
    }
    return (data || []).map(mapCalendarCategoryFromDb);
  },

  async saveCalendarCategory(category: CalendarEventCategory): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapCalendarCategoryToDb(category);
    const { error } = await client.from('calendar_categories').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveCalendarCategory Fehler: ${error.message}`);
  },

  async batchSaveCalendarCategories(categories: CalendarEventCategory[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client || categories.length === 0) return;
    const payloads = categories.map(mapCalendarCategoryToDb);
    const { error } = await client.from('calendar_categories').upsert(payloads, { onConflict: 'id' });
    if (error) throw new Error(`Supabase batchSaveCalendarCategories Fehler: ${error.message}`);
  },

  async deleteCalendarCategory(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('calendar_categories').delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteCalendarCategory Fehler: ${error.message}`);
  },

  // Documents
  async getDocuments(): Promise<ClubDocument[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('documents').select('*').order('upload_date', { ascending: false });
    if (error) {
      console.warn('Supabase getDocuments error:', error.message);
      return [];
    }
    return (data || []).map(mapDocumentFromDb);
  },

  async getDocument(id: string): Promise<ClubDocument | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('documents').select('*').eq('id', id).single();
    if (error || !data) return null;
    return mapDocumentFromDb(data);
  },

  async saveDocument(doc: ClubDocument): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapDocumentToDb(doc);
    const { error } = await client.from('documents').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveDocument Fehler: ${error.message}`);
  },

  async batchSaveDocuments(docs: ClubDocument[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client || docs.length === 0) return;
    const payloads = docs.map(mapDocumentToDb);
    const { error } = await client.from('documents').upsert(payloads, { onConflict: 'id' });
    if (error) throw new Error(`Supabase batchSaveDocuments Fehler: ${error.message}`);
  },

  async deleteDocument(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('documents').delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteDocument Fehler: ${error.message}`);
  },

  async deleteMultipleDocuments(ids: string[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client || ids.length === 0) return;
    const { error } = await client.from('documents').delete().in('id', ids);
    if (error) throw new Error(`Supabase deleteMultipleDocuments Fehler: ${error.message}`);
  },

  // Document Folders
  async getFolders(): Promise<DocumentFolder[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('folders').select('*').order('name', { ascending: true });
    if (error) {
      console.warn('Supabase getFolders error:', error.message);
      return [];
    }
    return (data || []).map(mapFolderFromDb);
  },

  async getFolder(id: string): Promise<DocumentFolder | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('folders').select('*').eq('id', id).single();
    if (error || !data) return null;
    return mapFolderFromDb(data);
  },

  async saveFolder(folder: DocumentFolder): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapFolderToDb(folder);
    const { error } = await client.from('folders').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveFolder Fehler: ${error.message}`);
  },

  async batchSaveFolders(folders: DocumentFolder[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client || folders.length === 0) return;
    const payloads = folders.map(mapFolderToDb);
    const { error } = await client.from('folders').upsert(payloads, { onConflict: 'id' });
    if (error) throw new Error(`Supabase batchSaveFolders Fehler: ${error.message}`);
  },

  async deleteFolder(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('folders').delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteFolder Fehler: ${error.message}`);
  },

  // Online Applications
  async getOnlineApplications(): Promise<OnlineMembershipApplication[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('online_applications').select('*').order('submitted_at', { ascending: false });
    if (error) {
      console.warn('Supabase getOnlineApplications error:', error.message);
      return [];
    }
    return (data || []).map(mapOnlineAppFromDb);
  },

  async getOnlineApplication(id: string): Promise<OnlineMembershipApplication | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('online_applications').select('*').eq('id', id).single();
    if (error || !data) return null;
    return mapOnlineAppFromDb(data);
  },

  async saveOnlineApplication(app: OnlineMembershipApplication): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapOnlineAppToDb(app);
    const { error } = await client.from('online_applications').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveOnlineApplication Fehler: ${error.message}`);
  },

  async batchSaveOnlineApplications(apps: OnlineMembershipApplication[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client || apps.length === 0) return;
    const payloads = apps.map(mapOnlineAppToDb);
    const { error } = await client.from('online_applications').upsert(payloads, { onConflict: 'id' });
    if (error) throw new Error(`Supabase batchSaveOnlineApplications Fehler: ${error.message}`);
  },

  async deleteOnlineApplication(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('online_applications').delete().eq('id', id);
    if (error) throw new Error(`Supabase deleteOnlineApplication Fehler: ${error.message}`);
  },

  // Application Settings
  async getApplicationSettings(): Promise<ApplicationTemplateSettings | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('application_settings').select('*').eq('id', 'main').single();
    if (error || !data) return null;
    return mapApplicationSettingsFromDb(data);
  },

  async saveApplicationSettings(settings: ApplicationTemplateSettings): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = mapApplicationSettingsToDb(settings);
    const { error } = await client.from('application_settings').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveApplicationSettings Fehler: ${error.message}`);
  },

  // Dashboard Config
  async getDashboardConfig(): Promise<UserDashboardConfig | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('dashboard_config').select('*').eq('id', 'main_dashboard').single();
    if (error || !data) return null;
    return {
      version: 1,
      widgets: data.widgets || [],
      updatedAt: data.updated_at
    };
  },

  async saveDashboardConfig(config: UserDashboardConfig): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const dbPayload = {
      id: 'main_dashboard',
      widgets: config.widgets || [],
      updated_at: config.updatedAt || new Date().toISOString()
    };
    const { error } = await client.from('dashboard_config').upsert(dbPayload, { onConflict: 'id' });
    if (error) throw new Error(`Supabase saveDashboardConfig Fehler: ${error.message}`);
  }
};
