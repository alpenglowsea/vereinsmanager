import React, { useState, useEffect, useMemo } from 'react';
import { MemberSurvey, Member, ClubSettings, DeploymentMode } from '../types';
import { StorageService } from '../services/storage';
import { SurveyBuilderModal } from './SurveyBuilderModal';
import { SurveyDistributionModal } from './SurveyDistributionModal';
import { SurveyAnalyticsModal } from './SurveyAnalyticsModal';
import { PublicSurveyView } from './PublicSurveyView';
import {
  Vote,
  Plus,
  Cloud,
  Lock,
  Calendar,
  Share2,
  BarChart3,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  Users,
  ShieldCheck,
  Search,
  Sparkles,
  Globe,
  Archive,
  Play,
  RotateCcw
} from 'lucide-react';

interface MemberSurveysViewProps {
  settings: ClubSettings;
  members: Member[];
  onNavigateToSettings?: () => void;
}

export const MemberSurveysView: React.FC<MemberSurveysViewProps> = ({
  settings,
  members,
  onNavigateToSettings
}) => {
  const [deploymentMode, setDeploymentMode] = useState<DeploymentMode>('local');
  const [surveys, setSurveys] = useState<MemberSurvey[]>([]);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [tokenCounts, setTokenCounts] = useState<Record<string, { total: number; used: number }>>({});
  const [loading, setLoading] = useState(true);

  // Modals state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedSurveyForEdit, setSelectedSurveyForEdit] = useState<MemberSurvey | null>(null);

  const [distributionSurvey, setDistributionSurvey] = useState<MemberSurvey | null>(null);
  const [analyticsSurvey, setAnalyticsSurvey] = useState<MemberSurvey | null>(null);
  const [previewSurveyId, setPreviewSurveyId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'closed'>('all');

  useEffect(() => {
    loadDeploymentModeAndData();
  }, []);

  const loadDeploymentModeAndData = async () => {
    try {
      setLoading(true);
      const mode = StorageService.getDeploymentMode();
      setDeploymentMode(mode);

      if (mode === 'cloud') {
        await loadSurveysData();
      }
    } catch (e) {
      console.warn('Fehler beim Initialisieren der Mitgliederbefragungen:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadSurveysData = async () => {
    const list = await StorageService.getSurveys();
    setSurveys(list);

    // Load response and token counts for each survey
    const respMap: Record<string, number> = {};
    const tokenMap: Record<string, { total: number; used: number }> = {};

    for (const s of list) {
      const [resps, toks] = await Promise.all([
        StorageService.getSurveyResponses(s.id),
        StorageService.getSurveyTokens(s.id)
      ]);
      respMap[s.id] = resps.length;
      tokenMap[s.id] = {
        total: toks.length,
        used: toks.filter(t => t.isUsed).length
      };
    }

    setResponseCounts(respMap);
    setTokenCounts(tokenMap);
  };

  const handleSaveSurvey = async (survey: MemberSurvey) => {
    await StorageService.saveSurvey(survey);
    await loadSurveysData();
  };

  const handleDeleteSurvey = async (id: string, title: string) => {
    if (!confirm(`Möchten Sie die Befragung "${title}" wirklich unwiderruflich löschen? Alle Antworten und Links werden dabei entfernt.`)) {
      return;
    }
    await StorageService.deleteSurvey(id);
    await loadSurveysData();
  };

  const handleToggleStatus = async (survey: MemberSurvey) => {
    const newStatus = survey.status === 'active' ? 'closed' : 'active';
    const updated: MemberSurvey = { ...survey, status: newStatus };
    await StorageService.saveSurvey(updated);
    await loadSurveysData();
  };

  // Filtered surveys
  const filteredSurveys = useMemo(() => {
    return surveys.filter(s => {
      const matchesSearch =
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.category && s.category.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [surveys, searchQuery, statusFilter]);

  // Overall KPIs
  const activeCount = surveys.filter(s => s.status === 'active').length;
  const totalSubmissions = Object.values(responseCounts).reduce((a: number, b: number) => a + b, 0);

  // ----------------------------------------------------
  // NON-CLOUD VIEW (Notice requirement 2)
  // ----------------------------------------------------
  if (deploymentMode !== 'cloud') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Vote className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span>Mitgliederbefragung & Meinungsbilder</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Digitale Befragungen, Feedback-Erfassung und Meinungsbildung im Verein
            </p>
          </div>
        </div>

        {/* Subtle, tasteful restriction banner as requested */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5 max-w-3xl">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
              <Cloud className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                  Cloud-Betrieb erforderlich
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Aktueller Modus: <strong className="text-slate-700 dark:text-slate-200">{deploymentMode === 'local' ? 'Lokaler Betrieb (Browser)' : 'Selfhosted'}</strong>
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                Diese Funktion steht ausschließlich im Cloud-Betrieb zur Verfügung
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Um Ihren Vereinsmitgliedern die Befragungen jederzeit ohne vorherige Registrierung über personalisierte Einmal-Links oder WhatsApp-Direktlinks bereitzustellen, ist eine synchronisierte Cloud-Anbindung erforderlich.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <span>Vorteile der Cloud-Mitgliederbefragung:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-500 dark:text-slate-400">
              <li>Teilnahme ohne App-Installation oder Login direkt am Smartphone</li>
              <li>Einmal-Token verhindern Mehrfachstimmabgaben wirksam</li>
              <li>Direktversand via WhatsApp Web und E-Mail-Einladung</li>
              <li>DSGVO-konforme, anonyme Auswertung mit Export als PDF und CSV</li>
            </ul>
          </div>

          {/* Optional: Switch to Cloud mode button for convenience */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                await StorageService.setDeploymentMode('cloud');
                setDeploymentMode('cloud');
                await loadSurveysData();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Cloud className="w-4 h-4" />
              <span>In den Cloud-Betrieb wechseln</span>
            </button>
            {onNavigateToSettings && (
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Zu den Betriebsmodus-Einstellungen
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // CLOUD VIEW: FULL MEMBER SURVEY DASHBOARD
  // ----------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Vote className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Mitgliederbefragung & Meinungsbilder</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Registrierungsfreie Feedback-Erfassung mit Einmal-Tokens, WhatsApp-Versand und Auswertung
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedSurveyForEdit(null);
              setBuilderOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Neue Befragung erstellen</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Laufende Befragungen
          </span>
          <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
            {activeCount}
          </p>
          <span className="text-[10px] text-slate-400">Für Mitglieder freigeschaltet</span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Gesamte Rückläufe
          </span>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {totalSubmissions}
          </p>
          <span className="text-[10px] text-slate-400">Eingereichte Fragebögen</span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Gesamt-Umfragen
          </span>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-white mt-1">
            {surveys.length}
          </p>
          <span className="text-[10px] text-slate-400">Inkl. Archiv & Entwürfe</span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Betriebsmodus
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-sm font-bold text-slate-800 dark:text-white">
              Cloud-Aktiv
            </p>
          </div>
          <span className="text-[10px] text-slate-400">Online-Abstimmung bereit</span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Befragung nach Titel oder Kategorie durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {(['all', 'active', 'draft', 'closed'] as const).map(st => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {st === 'all' && `Alle (${surveys.length})`}
              {st === 'active' && `Aktiv (${surveys.filter(s => s.status === 'active').length})`}
              {st === 'draft' && `Entwürfe (${surveys.filter(s => s.status === 'draft').length})`}
              {st === 'closed' && `Beendet (${surveys.filter(s => s.status === 'closed').length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Surveys List Cards */}
      {filteredSurveys.length === 0 ? (
        <div className="p-12 text-center text-slate-400 space-y-3 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Vote className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
            {surveys.length === 0
              ? 'Noch keine Befragungen angelegt'
              : 'Keine Befragungen mit diesem Filter gefunden'}
          </h3>
          <p className="text-xs max-w-md mx-auto">
            Erstellen Sie im Handumdrehen eine neue Mitgliederbefragung mit vorgefertigten Mustervorlagen oder eigenen Fragen.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedSurveyForEdit(null);
              setBuilderOpen(true);
            }}
            className="mt-3 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Erste Befragung anlegen</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredSurveys.map(survey => {
            const respCount = responseCounts[survey.id] || 0;
            const tokenStat = tokenCounts[survey.id] || { total: 0, used: 0 };
            const rate = tokenStat.total > 0
              ? Math.round((tokenStat.used / tokenStat.total) * 100)
              : (respCount > 0 ? 100 : 0);

            return (
              <div
                key={survey.id}
                className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                {/* Left info column */}
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Badge */}
                    {survey.status === 'active' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Aktiv</span>
                      </span>
                    )}
                    {survey.status === 'draft' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                        <Clock className="w-3 h-3" />
                        <span>Entwurf</span>
                      </span>
                    )}
                    {survey.status === 'closed' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                        <Archive className="w-3 h-3" />
                        <span>Beendet</span>
                      </span>
                    )}

                    {/* Category */}
                    {survey.category && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                        {survey.category}
                      </span>
                    )}

                    {/* Department */}
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {survey.department === 'all' || !survey.department ? 'Gesamtverein' : survey.department}
                    </span>

                    {/* Token Mode */}
                    {survey.useTokens ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Einmal-Tokens aktiv</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900 flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        <span>Öffentlicher Link</span>
                      </span>
                    )}

                    {survey.anonymous && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Anonym</span>
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white leading-snug">
                      {survey.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {survey.description}
                    </p>
                  </div>

                  {/* Meta metrics bar */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                      <strong>{survey.questions.length}</strong> Frage(n)
                    </span>

                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{survey.startDate || '—'} {survey.endDate ? `bis ${survey.endDate}` : ''}</span>
                    </span>

                    <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                      <Users className="w-3.5 h-3.5 text-emerald-500" />
                      <strong>{respCount}</strong> Rückmeldung(en) {tokenStat.total > 0 ? `(${rate}% Rücklaufquote)` : ''}
                    </span>
                  </div>
                </div>

                {/* Right Action buttons */}
                <div className="flex flex-wrap md:flex-col lg:flex-row items-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-700/80 pt-3 md:pt-0 md:pl-5">
                  {/* 1. Einladungen & Verteiler */}
                  <button
                    type="button"
                    onClick={() => setDistributionSurvey(survey)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title="Einladungslinks & WhatsApp-Versand öffnen"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Verteiler & Links</span>
                  </button>

                  {/* 2. Auswertung */}
                  <button
                    type="button"
                    onClick={() => setAnalyticsSurvey(survey)}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title="Ergebnisse und Auswertungsdiagramme ansehen"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Auswertung ({respCount})</span>
                  </button>

                  {/* 3. Vorschau */}
                  <button
                    type="button"
                    onClick={() => setPreviewSurveyId(survey.id)}
                    className="p-2 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    title="Vorschau der Befragung anzeigen"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {/* 4. Bearbeiten */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSurveyForEdit(survey);
                      setBuilderOpen(true);
                    }}
                    className="p-2 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    title="Befragung & Fragen bearbeiten"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {/* 5. Status Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(survey)}
                    className="p-2 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    title={survey.status === 'active' ? 'Befragung beenden' : 'Befragung aktivieren'}
                  >
                    {survey.status === 'active' ? <Archive className="w-4 h-4 text-amber-500" /> : <Play className="w-4 h-4 text-emerald-500" />}
                  </button>

                  {/* 6. Löschen */}
                  <button
                    type="button"
                    onClick={() => handleDeleteSurvey(survey.id, survey.title)}
                    className="p-2 bg-slate-100 dark:bg-slate-700/60 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    title="Befragung löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Builder Modal */}
      {builderOpen && (
        <SurveyBuilderModal
          isOpen={builderOpen}
          onClose={() => {
            setBuilderOpen(false);
            setSelectedSurveyForEdit(null);
          }}
          survey={selectedSurveyForEdit}
          onSave={handleSaveSurvey}
          settings={settings}
        />
      )}

      {/* MODAL 2: Distribution Modal */}
      {distributionSurvey && (
        <SurveyDistributionModal
          isOpen={Boolean(distributionSurvey)}
          onClose={() => setDistributionSurvey(null)}
          survey={distributionSurvey}
          members={members}
          settings={settings}
        />
      )}

      {/* MODAL 3: Analytics Modal */}
      {analyticsSurvey && (
        <SurveyAnalyticsModal
          isOpen={Boolean(analyticsSurvey)}
          onClose={() => setAnalyticsSurvey(null)}
          survey={analyticsSurvey}
          settings={settings}
        />
      )}

      {/* MODAL 4: Public Survey Modal Preview */}
      {previewSurveyId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex justify-center p-2 sm:p-4">
          <div className="w-full max-w-4xl my-auto">
            <PublicSurveyView
              surveyId={previewSurveyId}
              settings={settings}
              onClose={() => setPreviewSurveyId(null)}
              isPreview={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};
