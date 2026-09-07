import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ClubInvoice,
  InvoiceItem,
  Member,
  ClubContact,
  ClubSettings,
  InvoiceTemplateSettings,
  TaxSphere
} from '../types';
import { TAX_SPHERES } from '../data/taxSpheres';
import { formatCurrency } from '../services/invoicePdfService';
import {
  X,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Search,
  User,
  Building2,
  FileText,
  Check,
  Eye,
  Calendar,
  Layers,
  FolderArchive,
  AlertCircle
} from 'lucide-react';

interface InvoiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: ClubInvoice | null;
  members: Member[];
  contacts: ClubContact[];
  clubSettings: ClubSettings;
  templateSettings: InvoiceTemplateSettings;
  nextInvoiceNumber?: string;
  prefillRecipient?: {
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
  } | null;
  onSave: (invoice: ClubInvoice, saveToDocuments: boolean) => Promise<void>;
  onPreviewPdf?: (invoice: ClubInvoice) => void;
}

export const InvoiceFormModal: React.FC<InvoiceFormModalProps> = ({
  isOpen,
  onClose,
  invoice,
  members,
  contacts,
  clubSettings,
  templateSettings,
  nextInvoiceNumber = 'RE-2026-001',
  prefillRecipient,
  onSave,
  onPreviewPdf
}) => {
  // Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState(14);
  const [status, setStatus] = useState<ClubInvoice['status']>('open');
  const [taxSphere, setTaxSphere] = useState<TaxSphere>('wirtschaftlich');

  // Recipient State
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientType, setRecipientType] = useState<'member' | 'contact' | 'custom'>('custom');
  const [recipientId, setRecipientId] = useState<string | undefined>(undefined);
  const [recipientName, setRecipientName] = useState('');
  const [recipientCompany, setRecipientCompany] = useState('');
  const [recipientContactPerson, setRecipientContactPerson] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Deutschland');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  // Autocomplete UI State
  const [isSearchingRecipient, setIsSearchingRecipient] = useState(false);
  const recipientInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Content State
  const [title, setTitle] = useState('Rechnung');
  const [subject, setSubject] = useState('');
  const [introText, setIntroText] = useState('');
  const [outroText, setOutroText] = useState('');
  const [notes, setNotes] = useState('');

  // Line items state
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [selectedPositionIds, setSelectedPositionIds] = useState<Set<string>>(new Set());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Archive toggle
  const [saveToDocuments, setSaveToDocuments] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset form
  useEffect(() => {
    if (!isOpen) return;

    if (invoice) {
      // Editing existing invoice
      setInvoiceNumber(invoice.invoiceNumber);
      setDate(invoice.date);
      setDeliveryDate(invoice.deliveryDate || invoice.date);
      setDueDate(invoice.dueDate);
      setPaymentTermsDays(invoice.paymentTermsDays || 14);
      setStatus(invoice.status);
      setTaxSphere(invoice.taxSphere || 'wirtschaftlich');

      setRecipientType(invoice.recipientType);
      setRecipientId(invoice.recipientId);
      setRecipientName(invoice.recipientName || '');
      setRecipientCompany(invoice.recipientCompany || '');
      setRecipientContactPerson(invoice.recipientContactPerson || '');
      setStreet(invoice.recipientAddress?.street || '');
      setHouseNumber(invoice.recipientAddress?.houseNumber || '');
      setZip(invoice.recipientAddress?.zip || '');
      setCity(invoice.recipientAddress?.city || '');
      setCountry(invoice.recipientAddress?.country || 'Deutschland');
      setRecipientEmail(invoice.recipientEmail || '');
      setRecipientPhone(invoice.recipientPhone || '');

      setTitle(invoice.title || 'Rechnung');
      setSubject(invoice.subject || '');
      setIntroText(invoice.introText || '');
      setOutroText(invoice.outroText || '');
      setNotes(invoice.notes || '');

      setItems(invoice.items.map((it, idx) => ({ ...it, position: idx + 1 })));
      setSelectedPositionIds(new Set());
      setRecipientSearch('');
    } else {
      // New Invoice Defaults
      setInvoiceNumber(nextInvoiceNumber);
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      setDeliveryDate(today);

      const terms = templateSettings.defaultPaymentTermsDays || 14;
      setPaymentTermsDays(terms);
      const due = new Date();
      due.setDate(due.getDate() + terms);
      setDueDate(due.toISOString().split('T')[0]);

      setStatus('open');
      setTaxSphere('wirtschaftlich');

      // Recipient
      if (prefillRecipient) {
        setRecipientType(prefillRecipient.type || 'custom');
        setRecipientId(prefillRecipient.id);
        setRecipientName(prefillRecipient.name || '');
        setRecipientCompany(prefillRecipient.company || '');
        setRecipientContactPerson(prefillRecipient.contactPerson || '');
        setStreet(prefillRecipient.address?.street || '');
        setHouseNumber(prefillRecipient.address?.houseNumber || '');
        setZip(prefillRecipient.address?.zip || '');
        setCity(prefillRecipient.address?.city || '');
        setCountry(prefillRecipient.address?.country || 'Deutschland');
        setRecipientEmail(prefillRecipient.email || '');
        setRecipientPhone('');
        setRecipientSearch(prefillRecipient.name || '');
      } else {
        setRecipientType('custom');
        setRecipientId(undefined);
        setRecipientName('');
        setRecipientCompany('');
        setRecipientContactPerson('');
        setStreet('');
        setHouseNumber('');
        setZip('');
        setCity('');
        setCountry('Deutschland');
        setRecipientEmail('');
        setRecipientPhone('');
        setRecipientSearch('');
      }

      setTitle('Rechnung');
      setSubject('');
      setIntroText(templateSettings.defaultIntroText || '');
      setOutroText(templateSettings.defaultOutroText || '');
      setNotes('');

      // Default initial line item
      setItems([
        {
          id: `item-${Date.now()}-1`,
          position: 1,
          description: '',
          quantity: 1,
          unit: 'Stk.',
          unitPrice: '' as any,
          vatRate: 19,
          totalPrice: 0
        }
      ]);
      setSelectedPositionIds(new Set());
    }
  }, [isOpen, invoice, nextInvoiceNumber, templateSettings]);

  // Recalculate due date when date or terms change
  const handlePaymentTermsChange = (days: number) => {
    setPaymentTermsDays(days);
    if (date) {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      setDueDate(d.toISOString().split('T')[0]);
    }
  };

  // Close suggestions popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(e.target as Node) &&
        recipientInputRef.current &&
        !recipientInputRef.current.contains(e.target as Node)
      ) {
        setIsSearchingRecipient(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered recipient suggestions from Members and Contacts
  const recipientSuggestions = useMemo(() => {
    if (!recipientSearch || recipientSearch.trim().length < 1) return { members: [], contacts: [] };

    const q = recipientSearch.toLowerCase().trim();

    const matchedMembers = members.filter(m => {
      const name = `${m.firstName} ${m.lastName}`.toLowerCase();
      const num = (m.memberNumber || '').toLowerCase();
      const em = (m.email || '').toLowerCase();
      const cityStr = (m.address?.city || '').toLowerCase();
      return name.includes(q) || num.includes(q) || em.includes(q) || cityStr.includes(q);
    }).slice(0, 5);

    const matchedContacts = contacts.filter(c => {
      const disp = (c.displayName || '').toLowerCase();
      const comp = (c.companyName || '').toLowerCase();
      const num = (c.contactNumber || '').toLowerCase();
      const cp = c.contactPerson
        ? `${c.contactPerson.firstName || ''} ${c.contactPerson.lastName || ''}`.toLowerCase()
        : '';
      const em = (c.email || '').toLowerCase();
      const cityStr = (c.address?.city || '').toLowerCase();
      return disp.includes(q) || comp.includes(q) || num.includes(q) || cp.includes(q) || em.includes(q) || cityStr.includes(q);
    }).slice(0, 5);

    return { members: matchedMembers, contacts: matchedContacts };
  }, [recipientSearch, members, contacts]);

  const totalSuggestionsCount = recipientSuggestions.members.length + recipientSuggestions.contacts.length;

  // Handle selecting a Member suggestion
  const handleSelectMember = (m: Member) => {
    setRecipientType('member');
    setRecipientId(m.id);
    const fullName = `${m.firstName} ${m.lastName}`.trim();
    setRecipientName(fullName);
    setRecipientCompany('');
    setRecipientContactPerson('');
    setStreet(m.address?.street || '');
    setHouseNumber(m.address?.houseNumber || '');
    setZip(m.address?.zip || '');
    setCity(m.address?.city || '');
    setCountry(m.address?.country || 'Deutschland');
    setRecipientEmail(m.email || '');
    setRecipientPhone(m.phone || '');
    setIsSearchingRecipient(false);
    setRecipientSearch('');
  };

  // Handle selecting a Contact suggestion
  const handleSelectContact = (c: ClubContact) => {
    setRecipientType('contact');
    setRecipientId(c.id);
    setRecipientName(c.displayName || c.companyName || '');
    setRecipientCompany(c.companyName || (c.personType === 'legal' ? c.displayName : ''));

    if (c.contactPerson && (c.contactPerson.firstName || c.contactPerson.lastName)) {
      const salutation = c.contactPerson.salutation ? `${c.contactPerson.salutation} ` : '';
      const pos = c.contactPerson.roleOrPosition ? ` (${c.contactPerson.roleOrPosition})` : '';
      setRecipientContactPerson(`z. Hd. ${salutation}${c.contactPerson.firstName || ''} ${c.contactPerson.lastName || ''}${pos}`.trim());
    } else {
      setRecipientContactPerson('');
    }

    setStreet(c.address?.street || '');
    setHouseNumber(c.address?.houseNumber || '');
    setZip(c.address?.zip || '');
    setCity(c.address?.city || '');
    setCountry(c.address?.country || 'Deutschland');
    setRecipientEmail(c.email || '');
    setRecipientPhone(c.phone || c.mobile || '');
    setIsSearchingRecipient(false);
    setRecipientSearch('');
  };

  const handleUnlinkRecipient = () => {
    setRecipientType('custom');
    setRecipientId(undefined);
  };

  // Line Items Handlers
  const handleItemChange = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        // Recalculate total price when quantity or unitPrice changes
        if (field === 'quantity' || field === 'unitPrice') {
          const qty = field === 'quantity' ? (value === '' ? 0 : Number(value) || 0) : ((item.quantity as any) === '' ? 0 : Number(item.quantity) || 0);
          const price = field === 'unitPrice' ? (value === '' ? 0 : Number(value) || 0) : ((item.unitPrice as any) === '' ? 0 : Number(item.unitPrice) || 0);
          updated.totalPrice = Math.round(qty * price * 100) / 100;
        }
        return updated;
      })
    );
  };

  // Quantity change handler with integer stepper and max 1 decimal place (manually entered)
  const handleQuantityChange = (id: string, rawValue: string | number) => {
    if (rawValue === '') {
      handleItemChange(id, 'quantity', '');
      return;
    }
    let valStr = String(rawValue).replace(',', '.');
    // If there is a decimal part, strictly allow only ONE decimal place
    if (valStr.includes('.')) {
      const [intPart, decPart] = valStr.split('.');
      if (decPart && decPart.length > 1) {
        valStr = `${intPart}.${decPart.slice(0, 1)}`;
      }
    }
    handleItemChange(id, 'quantity', valStr);
  };

  // Up/Down arrow keys on quantity step strictly whole integers
  const handleQuantityKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    id: string,
    currentQuantity: number | string
  ) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const curr = Number(currentQuantity) || 0;
      const nextVal = Math.floor(curr) + 1;
      handleQuantityChange(id, nextVal);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const curr = Number(currentQuantity) || 0;
      const nextVal = Math.max(1, Math.ceil(curr) - 1);
      handleQuantityChange(id, nextVal);
    }
  };

  // Unit price change handler - strips unwanted leading zero
  const handleUnitPriceChange = (id: string, rawValue: string | number) => {
    if (rawValue === '') {
      handleItemChange(id, 'unitPrice', '');
      return;
    }
    let valStr = String(rawValue).replace(',', '.');
    // Strip leading zeros before a digit (e.g. '05' -> '5', '007' -> '7', but keep '0.5' / '0')
    if (/^0+[0-9]/.test(valStr)) {
      valStr = valStr.replace(/^0+(?=\d)/, '');
    }
    handleItemChange(id, 'unitPrice', valStr);
  };

  const handleAddItem = () => {
    const newItem: InvoiceItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      position: items.length + 1,
      description: '',
      quantity: 1,
      unit: 'Stk.',
      unitPrice: '' as any,
      vatRate: 19,
      totalPrice: 0
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleDeleteItem = (id: string) => {
    setItems(prev => {
      const filtered = prev.filter(item => item.id !== id);
      return filtered.map((item, idx) => ({ ...item, position: idx + 1 }));
    });
    setSelectedPositionIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Bulk Delete Selected Positions
  const handleDeleteSelectedPositions = () => {
    if (selectedPositionIds.size === 0) return;
    setItems(prev => {
      const remaining = prev.filter(item => !selectedPositionIds.has(item.id));
      return remaining.map((item, idx) => ({ ...item, position: idx + 1 }));
    });
    setSelectedPositionIds(new Set());
  };

  const handleToggleSelectPosition = (id: string) => {
    setSelectedPositionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllPositions = () => {
    if (selectedPositionIds.size === items.length && items.length > 0) {
      setSelectedPositionIds(new Set());
    } else {
      setSelectedPositionIds(new Set(items.map(i => i.id)));
    }
  };

  // Move up/down
  const handleMovePosition = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    setItems(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((item, idx) => ({ ...item, position: idx + 1 }));
    });
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    setItems(prev => {
      const copy = [...prev];
      const draggedItem = copy[draggedIndex];
      copy.splice(draggedIndex, 1);
      copy.splice(dropIndex, 0, draggedItem);
      return copy.map((item, idx) => ({ ...item, position: idx + 1 }));
    });
    setDraggedIndex(null);
  };

  // Calculate Totals
  const { subtotalNet, vatAmounts, totalVat, totalAmount } = useMemo(() => {
    let net = 0;
    const vatMap: { [rate: number]: number } = {};

    items.forEach(it => {
      const itemNet = it.totalPrice || 0;
      net += itemNet;
      const rate = it.vatRate || 0;
      const itemVat = Math.round(((itemNet * rate) / 100) * 100) / 100;
      vatMap[rate] = Math.round(((vatMap[rate] || 0) + itemVat) * 100) / 100;
    });

    const vTotal = Object.values(vatMap).reduce((sum, val) => sum + val, 0);
    const gross = Math.round((net + vTotal) * 100) / 100;

    return {
      subtotalNet: Math.round(net * 100) / 100,
      vatAmounts: vatMap,
      totalVat: Math.round(vTotal * 100) / 100,
      totalAmount: gross
    };
  }, [items]);

  // Construct current invoice object
  const constructInvoiceData = (): ClubInvoice => {
    return {
      id: invoice ? invoice.id : `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      invoiceNumber: invoiceNumber.trim() || nextInvoiceNumber,
      date,
      deliveryDate: deliveryDate || date,
      dueDate: dueDate || date,
      status,
      taxSphere,
      recipientType,
      recipientId,
      recipientName: recipientName.trim(),
      recipientCompany: recipientCompany.trim() || undefined,
      recipientContactPerson: recipientContactPerson.trim() || undefined,
      recipientAddress: {
        street: street.trim(),
        houseNumber: houseNumber.trim(),
        zip: zip.trim(),
        city: city.trim(),
        country: country.trim() || 'Deutschland'
      },
      recipientEmail: recipientEmail.trim() || undefined,
      recipientPhone: recipientPhone.trim() || undefined,
      title: title.trim() || 'Rechnung',
      subject: subject.trim(),
      introText: introText.trim() || undefined,
      items: items.map((it, idx) => {
        const q = Math.round((Number(it.quantity) || 1) * 10) / 10;
        const p = Number(it.unitPrice) || 0;
        return {
          ...it,
          position: idx + 1,
          quantity: q,
          unitPrice: p,
          totalPrice: Math.round(q * p * 100) / 100
        };
      }),
      outroText: outroText.trim() || undefined,
      subtotalNet,
      vatAmounts,
      totalVat,
      totalAmount,
      paymentTermsDays,
      notes: notes.trim() || undefined,
      createdAt: invoice ? invoice.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim()) {
      alert('Bitte geben Sie einen Empfängernamen an oder wählen Sie ein Mitglied bzw. einen Kontakt aus.');
      return;
    }
    if (items.length === 0) {
      alert('Bitte fügen Sie mindestens eine Rechnungsposition hinzu.');
      return;
    }

    setIsSubmitting(true);
    try {
      const invData = constructInvoiceData();
      await onSave(invData, saveToDocuments);
      onClose();
    } catch (err) {
      console.error('Failed to save invoice:', err);
      alert('Fehler beim Speichern der Rechnung.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-4 flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {invoice ? `Rechnung bearbeiten: ${invoice.invoiceNumber}` : 'Neue Rechnung erstellen'}
              </h3>
              <p className="text-xs text-slate-500">
                Erfassen Sie Empfänger, Rechnungspositionen und Zahlungskonditionen nach DIN 5008.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form noValidate onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SECTION 1: KOPFDATEN & RECHNUNGSNUMMER */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="sm:col-span-1 lg:col-span-2 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rechnungsnummer *
              </label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. RE-2026-001"
              />
            </div>

            <div className="sm:col-span-1 lg:col-span-2 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="open">Offen (Zahlung ausstehend)</option>
                <option value="paid">Bezahlt</option>
                <option value="draft">Entwurf</option>
                <option value="cancelled">Storniert</option>
              </select>
            </div>

            <div className="sm:col-span-1 lg:col-span-2 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rechnungsdatum *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (paymentTermsDays > 0) {
                    const d = new Date(e.target.value);
                    d.setDate(d.getDate() + paymentTermsDays);
                    setDueDate(d.toISOString().split('T')[0]);
                  }
                }}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-1 lg:col-span-3 min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Leistungs- / Lieferdatum
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 min-w-0">
              <div className="flex items-center justify-between mb-1 gap-1.5">
                <label className="block text-xs font-semibold text-slate-700 whitespace-nowrap">
                  Fälligkeitsdatum *
                </label>
                <select
                  value={paymentTermsDays}
                  onChange={(e) => handlePaymentTermsChange(Number(e.target.value))}
                  className="text-[10px] font-medium text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 rounded px-1.5 py-0.5 cursor-pointer focus:ring-1 focus:ring-blue-500 shrink-0"
                  title="Schnellauswahl Zahlungsziel"
                >
                  <option value="0">Sofort</option>
                  <option value="7">7 Tage</option>
                  <option value="14">14 Tage</option>
                  <option value="30">30 Tage</option>
                </select>
              </div>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-blue-700 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* SECTION 2: EMPFÄNGER-AUSWAHL MIT AUTOCOMPLETE (REQUIREMENT 4) */}
          <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span>Rechnungsempfänger</span>
                  {recipientType === 'member' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      <User className="w-3 h-3" /> Verknüpft mit Mitglied
                    </span>
                  )}
                  {recipientType === 'contact' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      <Building2 className="w-3 h-3" /> Verknüpft mit Kontakt / Firma
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-500">
                  Tippen Sie zur automatischen Übernahme von Mitglieds- oder Kontaktdaten.
                </p>
              </div>

              {recipientType !== 'custom' && (
                <button
                  type="button"
                  onClick={handleUnlinkRecipient}
                  className="text-xs text-slate-500 hover:text-slate-800 underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Verknüpfung aufheben (manuell anpassen)</span>
                </button>
              )}
            </div>

            {/* Autocomplete Search Input */}
            <div className="relative">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  ref={recipientInputRef}
                  type="text"
                  value={recipientSearch}
                  onChange={(e) => {
                    setRecipientSearch(e.target.value);
                    setIsSearchingRecipient(true);
                  }}
                  onFocus={() => {
                    if (recipientSearch.trim().length > 0) {
                      setIsSearchingRecipient(true);
                    }
                  }}
                  placeholder="Empfänger suchen: Name, Firma, Mitgliedsnummer oder Kontakt eingeben..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {recipientSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecipientSearch('');
                      setIsSearchingRecipient(false);
                    }}
                    className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Suggestions Popover */}
              {isSearchingRecipient && recipientSearch.trim().length > 0 && (
                <div
                  ref={searchDropdownRef}
                  className="absolute z-20 top-full mt-1.5 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto text-xs divide-y divide-slate-100"
                >
                  {totalSuggestionsCount === 0 ? (
                    <div className="p-3 text-slate-500 text-center">
                      Keine Treffer unter Mitgliedern oder Kontakten für "{recipientSearch}". Sie können die Felder unten manuell ausfüllen.
                    </div>
                  ) : (
                    <>
                      {/* Contacts Matches */}
                      {recipientSuggestions.contacts.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 bg-slate-50 text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                            <Building2 className="w-3 h-3 text-indigo-600" />
                            <span>Gefundene Kontakte / Firmen ({recipientSuggestions.contacts.length})</span>
                          </div>
                          {recipientSuggestions.contacts.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleSelectContact(c)}
                              className="w-full px-3 py-2 text-left hover:bg-indigo-50/70 flex items-center justify-between group transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                  {c.personType === 'legal' ? '🏢' : '👤'}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 group-hover:text-indigo-900">
                                    {c.displayName || c.companyName}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {c.contactPerson ? `Anspr.: ${c.contactPerson.firstName || ''} ${c.contactPerson.lastName || ''} • ` : ''}
                                    {c.address?.street ? `${c.address.street} ${c.address.houseNumber || ''}, ${c.address.zip || ''} ${c.address.city || ''}` : 'Keine Anschrift'}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono font-semibold bg-slate-100 px-2 py-0.5 rounded-sm text-slate-600">
                                {c.contactNumber || 'Kontakt'}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Members Matches */}
                      {recipientSuggestions.members.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 bg-slate-50 text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                            <User className="w-3 h-3 text-blue-600" />
                            <span>Gefundene Vereinsmitglieder ({recipientSuggestions.members.length})</span>
                          </div>
                          {recipientSuggestions.members.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleSelectMember(m)}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50/70 flex items-center justify-between group transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                                  👤
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 group-hover:text-blue-900">
                                    {m.firstName} {m.lastName}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {m.address?.street ? `${m.address.street} ${m.address.houseNumber || ''}, ${m.address.zip || ''} ${m.address.city || ''}` : 'Keine Anschrift'}
                                    {m.email ? ` • ${m.email}` : ''}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-sm">
                                {m.memberNumber}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Address Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Empfänger / Name *
                </label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Vor- und Nachname oder Firmenname"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Firma / Organisation (optional)
                </label>
                <input
                  type="text"
                  value={recipientCompany}
                  onChange={(e) => setRecipientCompany(e.target.value)}
                  placeholder="z.B. Stadtwerke AG oder Fa. Meier"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ansprechpartner / Zusatzzeile (optional)
                </label>
                <input
                  type="text"
                  value={recipientContactPerson}
                  onChange={(e) => setRecipientContactPerson(e.target.value)}
                  placeholder="z.B. z. Hd. Herrn Dr. Klaus Becker"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Straße</label>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Straße"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hausnr.</label>
                  <input
                    type="text"
                    value={houseNumber}
                    onChange={(e) => setHouseNumber(e.target.value)}
                    placeholder="Nr."
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PLZ</label>
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="12345"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ort</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Musterstadt"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-Mail (für Rechnungsversand)</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="rechnung@beispiel.de"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Telefon (optional)</label>
                <input
                  type="text"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="0123 456789"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: RECHNUNGSINHALT & BETREFF */}
          <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Betreff & Anschreiben
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Titel</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Betreffzeile *</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="z.B. Sponsoring Werbebande Sportplatz Hauptfeld Saison 2025/2026"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Einleitungstext</label>
              <textarea
                rows={2}
                value={introText}
                onChange={(e) => setIntroText(e.target.value)}
                placeholder="Sehr geehrte Damen und Herren..."
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* SECTION 4: RECHNUNGSPOSITIONEN MIT DRAG & DROP & MULTI-DELETE (REQUIREMENTS 5, 6, 7) */}
          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
            {/* Header with Title and Action Buttons */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Rechnungspositionen
                </h4>
                <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  {items.length} Position{items.length !== 1 ? 'en' : ''}
                </span>
                {selectedPositionIds.size > 0 && (
                  <span className="text-xs font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                    {selectedPositionIds.size} markiert
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Multi-delete button (Requirement 7) */}
                {selectedPositionIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteSelectedPositions}
                    className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer animate-in fade-in"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ausgewählte Positionen löschen ({selectedPositionIds.size})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Position hinzufügen</span>
                </button>
              </div>
            </div>

            {/* Position Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200 select-none">
                  <tr>
                    <th className="w-8 px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={items.length > 0 && selectedPositionIds.size === items.length}
                        onChange={handleSelectAllPositions}
                        title="Alle auswählen"
                        className="w-3.5 h-3.5 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="w-8 px-1 py-2 text-center" title="Per Drag & Drop verschiebbar">
                      ⇅
                    </th>
                    <th className="w-12 px-2 py-2 text-center">Pos.</th>
                    <th className="px-3 py-2">Bezeichnung & Beschreibung *</th>
                    <th className="w-24 px-2 py-2 text-right">Menge *</th>
                    <th className="w-24 px-2 py-2">Einheit</th>
                    <th className="w-28 px-2 py-2 text-right">Einzelpreis (€) *</th>
                    <th className="w-20 px-2 py-2 text-center">USt %</th>
                    <th className="w-28 px-3 py-2 text-right">Gesamt (€)</th>
                    <th className="w-16 px-2 py-2 text-center">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {items.map((item, index) => {
                    const isSelected = selectedPositionIds.has(item.id);
                    const isDragging = draggedIndex === index;

                    return (
                      <tr
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        className={`transition-colors ${
                          isDragging
                            ? 'opacity-40 bg-blue-50 border-2 border-dashed border-blue-400'
                            : isSelected
                            ? 'bg-amber-50/70'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Checkbox for selection */}
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectPosition(item.id)}
                            className="w-3.5 h-3.5 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>

                        {/* Drag Handle */}
                        <td className="px-1 py-2 text-center cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700">
                          <GripVertical className="w-4 h-4 mx-auto" />
                        </td>

                        {/* Position Number (Auto-computed 1, 2, 3...) */}
                        <td className="px-2 py-2 text-center font-mono font-bold text-slate-700">
                          {item.position || index + 1}
                        </td>

                        {/* Description */}
                        <td className="px-3 py-2">
                          <textarea
                            rows={1}
                            required
                            value={item.description}
                            onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                            placeholder="Leistungsbezeichnung..."
                            className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 resize-y"
                          />
                        </td>

                        {/* Quantity (Supports integer stepper & single decimal place manually) */}
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            required
                            step="1"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            onKeyDown={(e) => handleQuantityKeyDown(e, item.id, item.quantity)}
                            onFocus={(e) => e.target.select()}
                            placeholder="1"
                            className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs text-right font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
                          />
                        </td>

                        {/* Unit */}
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={item.unit || ''}
                            onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                            placeholder="Stk."
                            list="units-list"
                            className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                          />
                          <datalist id="units-list">
                            <option value="Stk." />
                            <option value="Std." />
                            <option value="Tage" />
                            <option value="Monate" />
                            <option value="Pauschale" />
                            <option value="Seite" />
                            <option value="m²" />
                          </datalist>
                        </td>

                        {/* Unit Price in EUR */}
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            required
                            step="0.01"
                            min="0"
                            value={item.unitPrice === 0 || (item.unitPrice as any) === '' ? ((item.unitPrice as any) === '' ? '' : item.unitPrice) : item.unitPrice}
                            onChange={(e) => handleUnitPriceChange(item.id, e.target.value)}
                            onFocus={(e) => {
                              if (item.unitPrice === 0 || item.unitPrice === '0' || (item.unitPrice as any) === '') {
                                handleItemChange(item.id, 'unitPrice', '');
                              } else {
                                e.target.select();
                              }
                            }}
                            placeholder="0,00"
                            className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs text-right font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
                          />
                        </td>

                        {/* VAT Rate */}
                        <td className="px-2 py-2 text-center">
                          <select
                            value={item.vatRate}
                            onChange={(e) => handleItemChange(item.id, 'vatRate', Number(e.target.value))}
                            className="w-full px-1.5 py-1 border border-slate-200 rounded-md text-xs text-center text-slate-800 focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="0">0 %</option>
                            <option value="7">7 %</option>
                            <option value="19">19 %</option>
                          </select>
                        </td>

                        {/* Total Price (Auto-computed) */}
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrency(item.totalPrice)}
                        </td>

                        {/* Actions (Single row delete and up/down arrows) */}
                        <td className="px-2 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMovePosition(index, 'up')}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                              title="Nach oben"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={index === items.length - 1}
                              onClick={() => handleMovePosition(index, 'down')}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                              title="Nach unten"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                              title="Position löschen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals Summary Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-500 space-y-1">
                <p className="flex items-center gap-1.5">
                  <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                  <span>Zeilen am Symbol anfassen, um sie per <strong>Drag & Drop</strong> beliebig zu sortieren.</span>
                </p>
                <p>Positionsnummern passen sich dabei automatisch fortlaufend an.</p>
              </div>

              <div className="w-full sm:w-72 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Summe Netto:</span>
                  <span className="font-mono font-semibold text-slate-900">{formatCurrency(subtotalNet)}</span>
                </div>

                {Object.entries(vatAmounts).map(([rate, amount]) => (
                  <div key={rate} className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>zzgl. {rate}% USt:</span>
                    <span className="font-mono font-medium text-slate-700">{formatCurrency(Number(amount))}</span>
                  </div>
                ))}

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold text-sm">
                  <span className="text-slate-900">Gesamtbetrag:</span>
                  <span className="font-mono text-blue-700">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: SCHLUSSTEXT & DOKUMENTENABLAGE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Schlusstext & Zahlungsanweisung
              </label>
              <textarea
                rows={3}
                value={outroText}
                onChange={(e) => setOutroText(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Interne Notizen (nicht auf Rechnung sichtbar)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="z.B. Genehmigt durch Vorstandssitzung..."
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Steuerliche Sphäre (für Buchhaltung & Auswertungen)
                  </label>
                  <select
                    value={taxSphere}
                    onChange={(e) => setTaxSphere(e.target.value as TaxSphere)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="wirtschaftlich">Wirtschaftlicher Geschäftsbetrieb (z.B. Sponsoring, Bewirtung)</option>
                    <option value="zweckbetrieb">Zweckbetrieb (z.B. Startgelder, Sportkurse, Hallenvermietung an Vereine)</option>
                    <option value="vermoegen">Vermögensverwaltung (z.B. dauerhafte Verpachtung Vereinsheim)</option>
                    <option value="ideell">Ideeller Bereich (z.B. Mitgliedsbeiträge, Auslagen)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Wird für die vereinsinterne Buchhaltung & EÜR/GuV hinterlegt; erscheint nicht im Kopf der Rechnung.
                  </p>
                </div>
              </div>

              {/* Requirement 8: Automatische Dokumentenablage */}
              <label className="flex items-center gap-2.5 p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToDocuments}
                  onChange={(e) => setSaveToDocuments(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                />
                <div className="flex items-center gap-1.5 text-xs text-blue-900">
                  <FolderArchive className="w-4 h-4 text-blue-700 shrink-0" />
                  <span className="font-semibold">
                    Rechnung als PDF automatisch in der Dokumentenverwaltung archivieren
                  </span>
                </div>
              </label>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-2">
            {onPreviewPdf && (
              <button
                type="button"
                onClick={() => onPreviewPdf(constructInvoiceData())}
                className="text-xs border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 px-3.5 py-2 rounded-xl font-medium transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Druckvorschau / PDF erzeugen</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-600 hover:text-slate-900 px-4 py-2 font-medium transition-colors cursor-pointer"
            >
              Abbrechen
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Wird gespeichert...' : invoice ? 'Rechnung aktualisieren' : 'Rechnung erstellen & speichern'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
