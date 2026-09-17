import React, { useState, useEffect, useMemo } from 'react';
import { MemberSurvey, MemberSurveyToken, Member, ClubSettings } from '../types';
import { StorageService } from '../services/storage';
import { SurveyPdfService } from '../services/surveyPdfService';
import {
  X,
  Share2,
  Copy,
  Check,
  MessageSquare,
  Mail,
  FileSpreadsheet,
  FileText,
  Search,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  Globe
} from 'lucide-react';

interface SurveyDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  survey: MemberSurvey;
  members: Member[];
  settings: ClubSettings;
}

export const SurveyDistributionModal: React.FC<SurveyDistributionModalProps> = ({
  isOpen,
  onClose,
  survey,
  members,
  settings
}) => {
  const [tokens, setTokens] = useState<MemberSurveyToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'used'>('all');
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [copiedGeneralLink, setCopiedGeneralLink] = useState(false);

  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : 'https://vereinsmanager.app';

  useEffect(() => {
    if (isOpen) {
      loadTokens();
    }
  }, [isOpen, survey.id]);

  const loadTokens = async () => {
    try {
      setLoading(true);
      const existing = await StorageService.getSurveyTokens(survey.id);
      setTokens(existing);
    } catch (e) {
      console.warn('Fehler beim Laden der Umfrage-Tokens:', e);
    } finally {
      setLoading(false);
    }
  };

  // Filter target members based on survey department
  const targetMembers = useMemo(() => {
    if (!survey.department || survey.department === 'all') {
      return members.filter(m => m.status === 'active' || m.status === 'honorary' || m.status === 'passive');
    }
    return members.filter(m => m.department === survey.department && m.status !== 'terminated');
  }, [members, survey.department]);

  // Generate tokens for target members if missing
  const handleGenerateOrSyncTokens = async () => {
    try {
      setGenerating(true);
      const existingMap = new Map(tokens.map(t => [t.memberId, t]));
      const newTokens: MemberSurveyToken[] = [];

      for (const m of targetMembers) {
        if (!existingMap.has(m.id)) {
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const cleanMemNo = (m.memberNumber || 'm').replace(/[^a-zA-Z0-9]/g, '');
          const tokenStr = `t_${cleanMemNo}_${randomSuffix}`;

          newTokens.push({
            id: `tok_${survey.id}_${m.id}`,
            surveyId: survey.id,
            memberId: m.id,
            token: tokenStr,
            memberName: `${m.firstName} ${m.lastName}`.trim(),
            memberNumber: m.memberNumber,
            memberEmail: m.email,
            memberPhone: m.phone,
            memberDepartment: m.department,
            isUsed: false,
            createdAt: new Date().toISOString()
          });
        }
      }

      if (newTokens.length > 0) {
        await StorageService.saveSurveyTokens(newTokens);
        await loadTokens();
      }
    } catch (e) {
      console.error('Fehler beim Generieren der Tokens:', e);
      alert('Fehler beim Generieren der Tokens.');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTokenId(id);
      setTimeout(() => setCopiedTokenId(null), 2000);
    } catch {
      // Fallback
      prompt('Link kopieren:', text);
    }
  };

  const handleCopyGeneralLink = async () => {
    const generalLink = `${baseUrl}?surveyId=${survey.id}`;
    try {
      await navigator.clipboard.writeText(generalLink);
      setCopiedGeneralLink(true);
      setTimeout(() => setCopiedGeneralLink(false), 2000);
    } catch {
      prompt('Öffentlichen Link kopieren:', generalLink);
    }
  };

  const getWhatsAppLink = (token: MemberSurveyToken) => {
    const memberLink = `${baseUrl}?surveyId=${survey.id}&token=${token.token}`;
    const cleanPhone = (token.memberPhone || '').replace(/[^0-9+]/g, '');
    const text = encodeURIComponent(
      `Hallo ${token.memberName.split(' ')[0]},\n\nwir bitten dich um deine Meinung bei unserer Vereinsbefragung "${survey.title}" des ${settings.clubName}.\n\nDein persönlicher Einmal-Teilnahmelink:\n${memberLink}\n\nVielen Dank für deine Unterstützung!`
    );

    if (cleanPhone) {
      return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${text}`;
    }
    return `https://wa.me/?text=${text}`;
  };

  const getEmailLink = (token: MemberSurveyToken) => {
    const memberLink = `${baseUrl}?surveyId=${survey.id}&token=${token.token}`;
    const subject = encodeURIComponent(`Mitgliederbefragung: ${survey.title} — ${settings.clubName}`);
    const body = encodeURIComponent(
      `Liebe(r) ${token.memberName},\n\n` +
      `als Mitglied des ${settings.clubName} ist uns Ihre Meinung besonders wichtig.\n\n` +
      `Wir führen aktuell die Befragung "${survey.title}" durch:\n` +
      `${survey.description}\n\n` +
      `Bitte nehmen Sie sich ca. 3–5 Minuten Zeit und öffnen Sie Ihren persönlichen Einladungslink:\n` +
      `${memberLink}\n\n` +
      `Hinweis: Dieser Link ist einmalig gültig und garantiert eine unverfälschte Stimmabgabe.\n\n` +
      `Mit sportlichen Grüßen\n` +
      `Der Vorstand\n${settings.clubName}`
    );

    return `mailto:${token.memberEmail || ''}?subject=${subject}&body=${body}`;
  };

  // Filtered token list
  const filteredTokens = useMemo(() => {
    return tokens.filter(t => {
      const matchesSearch =
        t.memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.memberNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.memberEmail && t.memberEmail.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDept = filterDepartment === 'all' || t.memberDepartment === filterDepartment;
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'used' && t.isUsed) ||
        (filterStatus === 'open' && !t.isUsed);

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [tokens, searchQuery, filterDepartment, filterStatus]);

  const usedCount = tokens.filter(t => t.isUsed).length;
  const openCount = tokens.filter(t => !t.isUsed).length;
  const participationRate = tokens.length > 0 ? Math.round((usedCount / tokens.length) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col border border-slate-200 dark:border-slate-800 max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 text-blue-400 rounded-xl border border-blue-500/30">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                Einladungen & Verteiler verwalten
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-md">
                {survey.title}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Survey Mode Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              {survey.useTokens ? (
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                  <Globe className="w-5 h-5" />
                </div>
              )}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                  {survey.useTokens
                    ? 'Modus: Personengebundene Einmal-Token aktiviert'
                    : 'Modus: Öffentlicher Link (Ohne Einmal-Token)'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {survey.useTokens
                    ? 'Jedes Mitglied erhält einen individuellen Link. Sobald abgestimmt wurde, verfällt der Link automatisch, um Mehrfachstimmabgaben zu verhindern.'
                    : 'Für weniger wichtige Umfragen: Alle Mitglieder nutzen denselben Link ohne persönliche Einmal-Tokens. Ideal für WhatsApp-Gruppen oder Vereinsheim-Aushänge.'}
                </p>
              </div>
            </div>

            {/* General link quick copy if not using tokens */}
            {!survey.useTokens && (
              <button
                type="button"
                onClick={handleCopyGeneralLink}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {copiedGeneralLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedGeneralLink ? 'Link kopiert!' : 'Öffentlichen Link kopieren'}</span>
              </button>
            )}
          </div>

          {/* Tokens Mode: Statistics & Generation Bar */}
          {survey.useTokens && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50">
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  Zielgruppe
                </span>
                <p className="text-xl font-bold text-slate-800 dark:text-white mt-1">
                  {tokens.length}
                </p>
                <span className="text-[10px] text-slate-500">Mitglieder mit Link</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50">
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  Offen
                </span>
                <p className="text-xl font-bold text-slate-800 dark:text-white mt-1">
                  {openCount}
                </p>
                <span className="text-[10px] text-slate-500">Noch nicht abgestimmt</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Abgestimmt
                </span>
                <p className="text-xl font-bold text-slate-800 dark:text-white mt-1">
                  {usedCount}
                </p>
                <span className="text-[10px] text-slate-500">Erfolgreich teilgenommen</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50">
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Rücklaufquote
                </span>
                <p className="text-xl font-bold text-slate-800 dark:text-white mt-1">
                  {participationRate} %
                </p>
                <div className="w-full bg-indigo-200 dark:bg-indigo-900 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 dark:bg-indigo-400 h-full rounded-full"
                    style={{ width: `${participationRate}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Mitglied suchen (Name, Nr.)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              {survey.useTokens && (
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="text-xs py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium focus:outline-hidden"
                >
                  <option value="all">Alle Status ({tokens.length})</option>
                  <option value="open">Offen ({openCount})</option>
                  <option value="used">Abgestimmt ({usedCount})</option>
                </select>
              )}

              {settings.departments && settings.departments.length > 0 && (
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="text-xs py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium focus:outline-hidden"
                >
                  <option value="all">Alle Sparten</option>
                  {settings.departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Export & Sync Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {survey.useTokens && tokens.length < targetMembers.length && (
                <button
                  type="button"
                  onClick={handleGenerateOrSyncTokens}
                  disabled={generating}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Fehlende Einmal-Links für Mitglieder generieren"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                  <span>Tokens generieren ({targetMembers.length - tokens.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => SurveyPdfService.exportSurveyTokensCsv(survey, tokens, baseUrl)}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Liste als CSV-Tabelle exportieren"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>CSV-Export</span>
              </button>

              <button
                type="button"
                onClick={() => SurveyPdfService.exportSurveyTokensPdf(survey, tokens, settings, baseUrl)}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Liste als formatiertes PDF exportieren (Ohne QR-Codes)"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>PDF-Export</span>
              </button>
            </div>
          </div>

          {/* Members Table */}
          {survey.useTokens ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto max-h-[50vh]">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 z-10 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3.5">Mitglied</th>
                      <th className="py-2.5 px-3">Sparte</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Einmal-Link & Versand</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {filteredTokens.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          {tokens.length === 0 ? (
                            <div className="space-y-2">
                              <p>Noch keine Einmal-Tokens für diese Befragung generiert.</p>
                              <button
                                type="button"
                                onClick={handleGenerateOrSyncTokens}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Jetzt Tokens für {targetMembers.length} Mitglieder generieren</span>
                              </button>
                            </div>
                          ) : (
                            'Keine passenden Mitglieder gefunden.'
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredTokens.map(token => {
                        const personalLink = `${baseUrl}?surveyId=${survey.id}&token=${token.token}`;
                        const isCopied = copiedTokenId === token.id;

                        return (
                          <tr
                            key={token.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            {/* Member info */}
                            <td className="py-2.5 px-3.5">
                              <div className="font-semibold text-slate-800 dark:text-white">
                                {token.memberName}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Nr: {token.memberNumber || '—'}
                              </div>
                            </td>

                            {/* Department */}
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-medium">
                                {token.memberDepartment || 'Gesamtverein'}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-3">
                              {token.isUsed ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/50">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Abgestimmt</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/50">
                                  <Clock className="w-3 h-3" />
                                  <span>Offen</span>
                                </span>
                              )}
                            </td>

                            {/* Actions & Links */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                {/* Copy button */}
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(personalLink, token.id)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                                    isCopied
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                                  }`}
                                  title="Persönlichen Link kopieren"
                                >
                                  {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  <span className="hidden sm:inline">{isCopied ? 'Kopiert' : 'Link'}</span>
                                </button>

                                {/* WhatsApp direct link */}
                                <a
                                  href={getWhatsAppLink(token)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shadow-2xs"
                                  title="Per WhatsApp Web versenden"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span className="hidden md:inline">WhatsApp</span>
                                </a>

                                {/* Email mailto link */}
                                {token.memberEmail ? (
                                  <a
                                    href={getEmailLink(token)}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shadow-2xs"
                                    title="E-Mail Entwurf öffnen"
                                  >
                                    <Mail className="w-3 h-3" />
                                    <span className="hidden md:inline">E-Mail</span>
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">Keine Mail</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Non-Token Mode: Global Share Box */
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-4 text-center max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-white">
                  Allgemeiner Teilnahmelink
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Dieser Link kann unbegrenzt geteilt werden. Mitglieder können ohne Registrierung direkt teilnehmen.
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-left">
                <span className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate select-all">
                  {baseUrl}?surveyId={survey.id}
                </span>
                <button
                  type="button"
                  onClick={handleCopyGeneralLink}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-all"
                >
                  {copiedGeneralLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedGeneralLink ? 'Kopiert!' : 'Kopieren'}</span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Hallo zusammen! Der ${settings.clubName} bittet um Teilnahme an der Befragung "${survey.title}":\n${baseUrl}?surveyId=${survey.id}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>In WhatsApp teilen</span>
                </a>

                <a
                  href={`mailto:?subject=${encodeURIComponent(`Umfrage: ${survey.title}`)}&body=${encodeURIComponent(
                    `Hallo,\n\nhier ist der Link zur Befragung "${survey.title}":\n${baseUrl}?surveyId=${survey.id}\n\nVielen Dank!`
                  )}`}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Mail className="w-4 h-4" />
                  <span>Per E-Mail teilen</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            Hinweis: QR-Codes wurden gemäß Vorgabe deaktiviert. Versand erfolgt direkt via WhatsApp & E-Mail.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
