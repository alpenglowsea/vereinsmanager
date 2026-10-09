import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Settings,
  Download,
  Trash2,
  PenTool
} from 'lucide-react';
import {
  OnlineMembershipApplication,
  Member,
  ClubSettings,
  ApplicationTemplateSettings
} from '../types';
import { ApplicationReviewModal } from './ApplicationReviewModal';
import { ApplicationTemplateModal } from './ApplicationTemplateModal';
import { PublicApplicationForm } from './PublicApplicationForm';
import { generateMembershipApplicationPdf } from '../services/membershipPdfService';

interface OnlineApplicationsViewProps {
  applications: OnlineMembershipApplication[];
  members: Member[];
  settings: ClubSettings;
  templateSettings: ApplicationTemplateSettings;
  onApproveApplication: (
    appId: string,
    memberData: Partial<Member>,
    author: string
  ) => Promise<{ member: Member; documentId: string }>;
  onRejectApplication: (appId: string, reason: string, author: string) => Promise<void>;
  onDeleteApplication: (appId: string) => Promise<void>;
  onSubmitNewApplication: (app: OnlineMembershipApplication) => Promise<void>;
  onSaveTemplateSettings: (updated: ApplicationTemplateSettings) => Promise<void>;
  currentUser?: string;
}

export const OnlineApplicationsView: React.FC<OnlineApplicationsViewProps> = ({
  applications = [],
  members = [],
  settings,
  templateSettings,
  onApproveApplication,
  onRejectApplication,
  onDeleteApplication,
  onSubmitNewApplication,
  onSaveTemplateSettings,
  currentUser = 'Vorstand / Administrator',
}) => {
  /**
   * Klick auf einen ändernden Knopf. Ohne Schreibrecht wird nicht die
   * Aktion ausgeführt, sondern der Hinweis gezeigt.
   */
  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // Modals state
  const [selectedApp, setSelectedApp] = useState<OnlineMembershipApplication | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isPublicFormModalOpen, setIsPublicFormModalOpen] = useState(false);

  // Stats
  const stats = useMemo(() => {
    const total = applications.length;
    const pending = applications.filter(a => a.status === 'pending').length;
    const approved = applications.filter(a => a.status === 'approved').length;
    const rejected = applications.filter(a => a.status === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [applications]);

  // Filtered applications
  const filteredApps = useMemo(() => {
    return applications
      .filter(a => {
        if (statusFilter !== 'all' && a.status !== statusFilter) return false;
        if (departmentFilter !== 'all' && a.department !== departmentFilter) return false;
        if (searchTerm.trim()) {
          const s = searchTerm.toLowerCase();
          const fullName = `${a.firstName} ${a.lastName}`.toLowerCase();
          const email = a.email.toLowerCase();
          const appNum = a.applicationNumber.toLowerCase();
          const city = a.address.city.toLowerCase();
          return fullName.includes(s) || email.includes(s) || appNum.includes(s) || city.includes(s);
        }
        return true;
      })
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [applications, statusFilter, departmentFilter, searchTerm]);

  // Direct PDF Download
  const handleDownloadPdf = (app: OnlineMembershipApplication, e: React.MouseEvent) => {
    e.stopPropagation();
    const doc = generateMembershipApplicationPdf(app, settings);
    doc.save(`Aufnahmeantrag_${app.lastName}_${app.firstName}_${app.applicationNumber}.pdf`);
  };

  // Delete with confirm
  const handleDelete = async (appId: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Möchten Sie den Antrag von ${name} wirklich löschen?`)) {
      await onDeleteApplication(appId);
    }
  };

  return (
    <div className="space-y-6">

      {/* 1. Header & Actions Card */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs dark:bg-slate-900 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight dark:text-white">
                Mitgliedsanträge
              </h1>
              {stats.pending > 0 && (
                <span className="text-2xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse flex items-center gap-1.5 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                  {stats.pending} {stats.pending === 1 ? 'neuer Antrag' : 'neue Anträge'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed dark:text-slate-400">
              Vollständig digitaler Aufnahme-Workflow mit digitaler Signatur, automatischer Plausibilitätsprüfung und Archivierung im Dokumentenarchiv.
            </p>
          </div>

          {/* Top Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 shadow-2xs transition-colors cursor-pointer dark:bg-slate-800 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
              title="PDF-Vorlage und Gebühren einstellen"
            >
              <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>PDF-Vorlage & Gebühren</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPublicFormModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Antragsformular</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setStatusFilter('pending')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'pending'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200 dark:bg-amber-950/40 dark:border-amber-700/60'
              : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-800 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700 mb-1 dark:text-amber-300">
            <span className="text-2xs font-bold uppercase tracking-wider">Offene Anträge</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.pending}</div>
          <div className="text-2xs text-slate-500 mt-0.5 dark:text-slate-400">Warten auf Prüfung</div>
        </div>

        <div
          onClick={() => setStatusFilter('approved')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'approved'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-700/60'
              : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-800 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-700 mb-1 dark:text-emerald-300">
            <span className="text-2xs font-bold uppercase tracking-wider">Aufgenommen</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.approved}</div>
          <div className="text-2xs text-slate-500 mt-0.5 dark:text-slate-400">Mitglied & PDF archiviert</div>
        </div>

        <div
          onClick={() => setStatusFilter('rejected')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'rejected'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200 dark:bg-rose-950/40 dark:border-rose-700/60'
              : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-800 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-rose-700 mb-1 dark:text-rose-300">
            <span className="text-2xs font-bold uppercase tracking-wider">Abgelehnt</span>
            <XCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.rejected}</div>
          <div className="text-2xs text-slate-500 mt-0.5 dark:text-slate-400">Nicht aufgenommen</div>
        </div>

        <div
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200 dark:bg-blue-950/40 dark:border-blue-700/60'
              : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-800 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-blue-700 mb-1 dark:text-blue-300">
            <span className="text-2xs font-bold uppercase tracking-wider">Gesamt</span>
            <FileText className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</div>
          <div className="text-2xs text-slate-500 mt-0.5 dark:text-slate-400">Eingegangene Anträge</div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 dark:bg-slate-900 dark:border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Name, E-Mail, Antrags-Nr. suchen..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden dark:border-slate-700"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">Alle Status</option>
            <option value="pending">Nur Offene ({stats.pending})</option>
            <option value="approved">Nur Aufgenommene ({stats.approved})</option>
            <option value="rejected">Nur Abgelehnte ({stats.rejected})</option>
          </select>

          <select
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">Alle Sparten</option>
            {settings.departments.map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Applications Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        {filteredApps.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto dark:bg-blue-950/40 dark:text-blue-400">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Keine Aufnahmeanträge gefunden</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto dark:text-slate-400">
              {searchTerm || statusFilter !== 'all' || departmentFilter !== 'all'
                ? 'Passen Sie Ihre Such- oder Filterkriterien an.'
                : 'Es liegen aktuell noch keine Aufnahmeanträge vor. Nutzen Sie den Button "Antrag einreichen", um einen Antrag zu erfassen.'}
            </p>
            <button
              type="button"
              onClick={() => setIsPublicFormModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Antrag einreichen</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Status / Antrags-Nr.</th>
                  <th className="py-3 px-4">Antragsteller</th>
                  <th className="py-3 px-4">Sparte & Art</th>
                  <th className="py-3 px-4">Zahlungsweg</th>
                  <th className="py-3 px-4">Signatur</th>
                  <th className="py-3 px-4">Eingang</th>
                  <th className="py-3 px-4 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredApps.map(app => (
                  <tr
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group dark:hover:bg-blue-950/40"
                  >
                    {/* Status & Nr */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <span className="font-mono text-2xs font-bold text-slate-700 block dark:text-slate-200">
                          {app.applicationNumber}
                        </span>
                        {app.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                            Prüfung offen
                          </span>
                        )}
                        {app.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700/60">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            Aufgenommen ({app.createdMemberNumber})
                          </span>
                        )}
                        {app.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700/60">
                            <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                            Abgelehnt
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Antragsteller */}
                    <td className="py-3.5 px-4">
                      <div>
                        <strong className="text-slate-900 font-bold text-xs block group-hover:text-blue-600 transition-colors dark:text-white dark:group-hover:text-blue-400">
                          {app.lastName}, {app.firstName}
                        </strong>
                        <span className="text-2xs text-slate-500 block dark:text-slate-400">
                          {app.email}
                        </span>
                        {app.isMinor && (
                          <span className="inline-block mt-0.5 text-2xs font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60">
                            U18 (Vertreter: {app.guardianName})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Sparte */}
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-semibold text-slate-800 block dark:text-slate-100">
                          {app.department}
                        </span>
                        <span className="text-2xs text-slate-500 dark:text-slate-400">
                          {app.membershipType === 'full' && 'Vollmitglied'}
                          {app.membershipType === 'reduced' && 'Ermäßigt'}
                          {app.membershipType === 'youth' && 'Jugend'}
                          {app.membershipType === 'family' && 'Familie'}
                          {app.membershipType === 'supporting' && 'Fördernd'}
                        </span>
                      </div>
                    </td>

                    {/* Zahlungsweg */}
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-semibold text-slate-800 block dark:text-slate-100">
                          {app.paymentMethod === 'sepa' ? 'SEPA-Lastschrift' : 'Überweisung'}
                        </span>
                        {app.paymentMethod === 'sepa' && app.bankDetails?.iban && (
                          <span className="font-mono text-2xs text-slate-500 dark:text-slate-400">
                            {app.bankDetails.iban.slice(0, 8)}...{app.bankDetails.iban.slice(-4)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Signatur */}
                    <td className="py-3.5 px-4">
                      {app.applicantSignature ? (
                        <span className="inline-flex items-center gap-1 text-2xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/60">
                          <PenTool className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Signiert
                        </span>
                      ) : (
                        <span className="text-2xs text-slate-400 italic">Fehlt</span>
                      )}
                    </td>

                    {/* Eingang */}
                    <td className="py-3.5 px-4 text-2xs text-slate-600 dark:text-slate-300">
                      <div>{new Date(app.submittedAt).toLocaleDateString('de-DE')}</div>
                      <div className="text-slate-400">
                        {new Date(app.submittedAt).toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })} Uhr
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedApp(app)}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-2xs font-bold rounded-lg border border-blue-200 transition-colors dark:bg-blue-950/40 dark:hover:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/60"
                        >
                          {app.status === 'pending' ? 'Prüfen & Bestätigen' : 'Details'}
                        </button>

                        <button
                          type="button"
                          onClick={e => handleDownloadPdf(app, e)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors dark:text-slate-400 dark:hover:text-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-800"
                          title="PDF herunterladen"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={e => handleDelete(app.id, `${app.firstName} ${app.lastName}`, e)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-lg border border-slate-200 hover:border-rose-200 transition-colors dark:hover:text-rose-400 dark:bg-slate-800 dark:hover:bg-rose-950/40 dark:border-slate-800 dark:hover:border-rose-800/60"
                          title="Antrag löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedApp && (
        <ApplicationReviewModal
          isOpen={Boolean(selectedApp)}
          onClose={() => setSelectedApp(null)}
          application={selectedApp}
          existingMembers={members}
          settings={settings}
          onApprove={onApproveApplication}
          onReject={onRejectApplication}
          currentUser={currentUser}
        />
      )}


      {/* Template Settings Modal */}
      {isTemplateModalOpen && (
        <ApplicationTemplateModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          settings={settings}
          templateSettings={templateSettings}
          onSaveTemplateSettings={onSaveTemplateSettings}
        />
      )}

      {/* Public Form Preview Modal */}
      {isPublicFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl my-6">
            <PublicApplicationForm
              settings={settings}
              templateSettings={templateSettings}
              onSubmitApplication={async app => {
                await onSubmitNewApplication(app);
              }}
              onClose={() => setIsPublicFormModalOpen(false)}
            />
          </div>
        </div>
      )}

    </div>
  );
};
