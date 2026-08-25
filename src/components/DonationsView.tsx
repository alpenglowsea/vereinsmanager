import React, { useState } from 'react';
import {
  DonationReceipt,
  Member,
  FinancialAccount,
  ClubSettings,
  ClubDocument
} from '../types';
import { downloadDonationReceiptPdf } from '../services/donationService';
import {
  HeartHandshake,
  Plus,
  Search,
  Calendar,
  Filter,
  Download,
  Eye,
  Trash2,
  Edit2,
  FileCheck,
  Coins,
  Package,
  ArrowUpRight,
  ShieldCheck,
  Info,
  Building2,
  User,
  CheckCircle2,
  FileText
} from 'lucide-react';

interface DonationsViewProps {
  donations: DonationReceipt[];
  members: Member[];
  accounts: FinancialAccount[];
  settings: ClubSettings;
  documents: ClubDocument[];
  onOpenCreateModal: () => void;
  onEditReceipt: (receipt: DonationReceipt) => void;
  onDeleteReceipt: (id: string) => void;
  onViewDocument?: (doc: ClubDocument) => void;
}

export const DonationsView: React.FC<DonationsViewProps> = ({
  donations,
  members,
  accounts,
  settings,
  documents,
  onOpenCreateModal,
  onEditReceipt,
  onDeleteReceipt,
  onViewDocument
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'money' | 'goods'>('all');

  // Extract years
  const years = Array.from(
    new Set(donations.map(d => (d.date ? d.date.substring(0, 4) : '2025')))
  ).sort().reverse();
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // Filtered donations
  const filteredDonations = donations.filter(d => {
    // Year filter
    if (selectedYear !== 'all') {
      if (!d.date || !d.date.startsWith(selectedYear)) return false;
    }
    // Type filter
    if (selectedType !== 'all') {
      if (d.type !== selectedType) return false;
    }
    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = d.donorName.toLowerCase().includes(q);
      const matchNum = d.receiptNumber.toLowerCase().includes(q);
      const matchCity = d.donorAddress?.city?.toLowerCase().includes(q);
      const matchNotes = d.notes?.toLowerCase().includes(q);
      const matchGoods = d.goodsDescription?.toLowerCase().includes(q);
      if (!matchName && !matchNum && !matchCity && !matchNotes && !matchGoods) {
        return false;
      }
    }
    return true;
  });

  // Calculate statistics
  const totalAmount = filteredDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
  const moneyDonations = filteredDonations.filter(d => d.type === 'money');
  const moneyTotal = moneyDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
  const goodsDonations = filteredDonations.filter(d => d.type === 'goods');
  const goodsTotal = goodsDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
  const waiverCount = filteredDonations.filter(d => d.isWaiverOfRefund).length;

  const handleDownload = (receipt: DonationReceipt) => {
    downloadDonationReceiptPdf(receipt, settings);
  };

  const handleViewDoc = (receipt: DonationReceipt) => {
    if (onViewDocument && receipt.documentId) {
      const foundDoc = documents.find(doc => doc.id === receipt.documentId);
      if (foundDoc) {
        onViewDocument(foundDoc);
        return;
      }
    }
    // Fallback: direct download
    handleDownload(receipt);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Amtliche Spendenverwaltung (BMF-Muster)</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Geld- & Sachzuwendungen
            </h1>
            <p className="text-slate-300 text-xs mt-1 max-w-2xl">
              Erstellung, Verwaltung und revisionssichere Archivierung rechtskonformer Zuwendungsbestätigungen nach den amtlichen Mustern des Bundesministeriums der Finanzen (§ 50 Abs. 1 EStDV).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenCreateModal}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow-md flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Neue Zuwendungsbestätigung</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Gesamtes Spendenvolumen</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <HeartHandshake className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
            {totalAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="mt-1 text-2xs text-slate-500">
            {filteredDonations.length} Bestätigung{filteredDonations.length === 1 ? '' : 'en'} gesamt
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Geldzuwendungen (Muster 1)</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-700">
            {moneyTotal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="mt-1 text-2xs text-slate-500">
            {moneyDonations.length} Geldspende{moneyDonations.length === 1 ? '' : 'n'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Sachzuwendungen (Muster 2)</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-blue-700">
            {goodsTotal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="mt-1 text-2xs text-slate-500">
            {goodsDonations.length} Sachspende{goodsDonations.length === 1 ? '' : 'n'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Aufwandsspenden</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
            {waiverCount}
          </div>
          <div className="mt-1 text-2xs text-slate-500">
            Verzicht auf Erstattung
          </div>
        </div>
      </div>

      {/* Main List Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Spender, Beleg-Nr., Zweck suchen..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Type selector */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5">
              <button
                onClick={() => setSelectedType('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  selectedType === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Alle ({donations.length})
              </button>
              <button
                onClick={() => setSelectedType('money')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                  selectedType === 'money'
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Coins className="w-3 h-3" />
                Geld ({donations.filter(d => d.type === 'money').length})
              </button>
              <button
                onClick={() => setSelectedType('goods')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                  selectedType === 'goods'
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3 h-3" />
                Sachspenden ({donations.filter(d => d.type === 'goods').length})
              </button>
            </div>

            {/* Year filter */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="bg-transparent border-0 text-xs font-semibold text-slate-700 focus:ring-0 p-0 pr-2"
              >
                <option value="all">Alle Jahre</option>
                {years.map(y => (
                  <option key={y} value={y}>Jahr {y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-2xs text-slate-500">
            Zeige <span className="font-bold text-slate-800">{filteredDonations.length}</span> von {donations.length} Bescheinigungen
          </div>
        </div>

        {/* Table */}
        {filteredDonations.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-3">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Keine Zuwendungsbestätigungen gefunden</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Für die gewählten Filter liegen noch keine Spendenbescheinigungen vor. Erstellen Sie eine neue Bestätigung mit dem BMF-Muster.
            </p>
            <button
              onClick={onOpenCreateModal}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Neue Zuwendungsbestätigung anlegen</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold text-2xs uppercase tracking-wider">
                  <th className="py-3 px-4">Nr. & Datum</th>
                  <th className="py-3 px-4">Zuwendender / Spender</th>
                  <th className="py-3 px-4">Art & Muster</th>
                  <th className="py-3 px-4">Zweck / Gegenstand</th>
                  <th className="py-3 px-4 text-right">Betrag / Wert</th>
                  <th className="py-3 px-4 text-center">Status / Archiv</th>
                  <th className="py-3 px-4 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDonations.map(receipt => {
                  const isGoods = receipt.type === 'goods';
                  const hasDoc = Boolean(receipt.documentId || documents.some(d => d.transactionId === receipt.transactionId));

                  return (
                    <tr
                      key={receipt.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Nr. & Datum */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">
                          {receipt.receiptNumber}
                        </div>
                        <div className="text-2xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{new Date(receipt.date).toLocaleDateString('de-DE')}</span>
                        </div>
                      </td>

                      {/* Spender */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          {receipt.donorType === 'member' ? (
                            <span className="p-0.5 bg-emerald-100 text-emerald-800 rounded text-3xs font-semibold px-1">Mitglied</span>
                          ) : (
                            <span className="p-0.5 bg-slate-100 text-slate-700 rounded text-3xs font-semibold px-1">Extern</span>
                          )}
                          <span>{receipt.donorName}</span>
                        </div>
                        <div className="text-2xs text-slate-500 mt-0.5">
                          {receipt.donorAddress.street} {receipt.donorAddress.houseNumber}, {receipt.donorAddress.zip} {receipt.donorAddress.city}
                        </div>
                      </td>

                      {/* Art & Muster */}
                      <td className="py-3 px-4">
                        {isGoods ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Package className="w-3 h-3" />
                            Sachspende (Muster 2)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Coins className="w-3 h-3" />
                            Geldspende (Muster 1)
                          </span>
                        )}
                        {receipt.isWaiverOfRefund && (
                          <div className="mt-1 text-3xs font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block">
                            Aufwandsspende
                          </div>
                        )}
                      </td>

                      {/* Zweck / Gegenstand */}
                      <td className="py-3 px-4 max-w-xs">
                        {isGoods ? (
                          <div className="text-slate-800 font-medium truncate" title={receipt.goodsDescription}>
                            {receipt.goodsDescription || 'Sachzuwendung'}
                          </div>
                        ) : (
                          <div className="text-slate-800 font-medium truncate" title={receipt.notes || receipt.promotedPurpose}>
                            {receipt.notes || receipt.promotedPurpose || 'Förderung des Sports'}
                          </div>
                        )}
                        <div className="text-3xs text-slate-400 font-mono mt-0.5 truncate">
                          {receipt.amountInWords}
                        </div>
                      </td>

                      {/* Betrag */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-mono font-bold text-sm text-slate-900">
                          {receipt.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </div>
                        {receipt.transactionId && (
                          <div className="text-3xs text-emerald-600 font-semibold flex items-center justify-end gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Verbucht
                          </div>
                        )}
                      </td>

                      {/* Status / Archiv */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-3xs font-semibold rounded-full border border-emerald-200">
                          <FileCheck className="w-3 h-3 text-emerald-600" />
                          BMF-Archiviert
                        </span>
                      </td>

                      {/* Aktionen */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Download PDF */}
                          <button
                            type="button"
                            onClick={() => handleDownload(receipt)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                            title="BMF Zuwendungsbestätigung als PDF herunterladen"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* View in Document Viewer */}
                          {onViewDocument && (
                            <button
                              type="button"
                              onClick={() => handleViewDoc(receipt)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                              title="In Dokumentenablage ansehen"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => onEditReceipt(receipt)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                            title="Bearbeiten"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Möchten Sie die Zuwendungsbestätigung ${receipt.receiptNumber} wirklich löschen?`)) {
                                onDeleteReceipt(receipt.id);
                              }
                            }}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                            title="Löschen"
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
        )}
      </div>

      {/* Legal Information Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-600 space-y-3">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <Info className="w-4 h-4 text-emerald-600" />
          <span>Wichtige steuerliche Hinweise zu Zuwendungsbestätigungen</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-2xs leading-relaxed text-slate-600">
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">§ 10b EStG Vereinfachter Spendennachweis</span>
            Für Spenden bis einschließlich <span className="font-bold">300,00 €</span> genügt dem Finanzamt in der Regel ein vereinfachter Nachweis (Kontoauszug oder Buchungsbestätigung) zusammen mit dem Freistellungsbescheid des Vereins. Dennoch kann auf Wunsch eine Bestätigung ausgestellt werden.
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">Aufwandsspenden (§ 10b Abs. 3 EStG)</span>
            Wird auf den Ersatz von Aufwendungen (z.B. Fahrtkosten, Schiedsrichterauslagen) verzichtet, muss ein zuvor schriftlich vereinbarter Rechtsanspruch bestanden haben. Dies wird auf der Bestätigung separat angekreuzt.
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">Revisionssichere Archivierung</span>
            Alle erstellten Bestätigungen werden automatisch im PDF-Format im Ordner <span className="font-bold">Dokumente & Belege</span> hinterlegt und können für die Betriebsprüfung oder EÜR jederzeit nachgewiesen werden.
          </div>
        </div>
      </div>
    </div>
  );
};
