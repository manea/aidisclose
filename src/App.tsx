import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Database,
  FileCheck2,
  Globe,
  HardDrive,
  Lock,
  Moon,
  PlusCircle,
  Save,
  Shield,
  Sun,
  Trash2,
} from 'lucide-react';
import DossierPreviewAndPrint from './components/DossierPreviewAndPrint.tsx';
import LiteracyAndBatchPanel from './components/LiteracyAndBatchPanel.tsx';
import OrganizationAndFeaturesPanel from './components/OrganizationAndFeaturesPanel.tsx';
import { auditAiTransparencyAndLiteracy } from './core/disclosureAuditor.ts';
import { computeAiDiscloseSummary } from './core/noticeAndLiteracy.ts';
import { createDossierFromPreset, type AiDisclosePresetId, type AiDisclosePresetMeta } from './core/presets.ts';
import type { AiDiscloseDossier, Locale, OrganizationAiProfile } from './core/types.ts';
import {
  createDossierFromPresetApi,
  createProfileApi,
  deleteDossierApi,
  deleteProfileApi,
  detectServerHealth,
  duplicateDossierApi,
  fetchPresets,
  finalizeDossierApi,
  getDossier,
  getPublicDossier,
  listDossiers,
  listProfilesApi,
  recomputeLocalDossierMetrics,
  saveDossierDraft,
  type DossierBundle,
  type DossierListRecord,
  type OrgProfileRecord,
} from './lib/api.ts';
import { stripBase, withBase } from './lib/basePath.ts';
import { getUiCopy, type ThemeId } from './lib/i18n.ts';

type WorkspaceTab = 'surfaces' | 'literacy' | 'dossier';

const LOCALE_KEY = 'aidisclose_locale_v1';
const THEME_KEY = 'aidisclose_theme_v1';

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    try {
      return window.localStorage.getItem(LOCALE_KEY) === 'ar' ? 'ar' : 'en';
    } catch {
      return 'en';
    }
  });

  const [theme, setTheme] = useState<ThemeId>(() => {
    try {
      return window.localStorage.getItem(THEME_KEY) === 'carbon-violet'
        ? 'carbon-violet'
        : 'veridian';
    } catch {
      return 'veridian';
    }
  });

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('surfaces');
  const [serverOnline, setServerOnline] = useState(false);
  const [presets, setPresets] = useState<readonly AiDisclosePresetMeta[]>([]);
  const [dossiers, setDossiers] = useState<DossierListRecord[]>([]);
  const [profiles, setProfiles] = useState<OrgProfileRecord[]>([]);
  const [activeBundle, setActiveBundle] = useState<DossierBundle | null>(null);
  const [draftDossier, setDraftDossier] = useState<AiDiscloseDossier>(() =>
    recomputeLocalDossierMetrics(createDossierFromPreset('saas-copilot-compliant')),
  );
  const [publicSlugOrNum, setPublicSlugOrNum] = useState<string | null>(() => {
    const clean = stripBase(window.location.pathname);
    const match = clean.match(/^\/r\/([^/]+)$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  });
  const [publicNotFound, setPublicNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const copy = useMemo(() => getUiCopy(locale), [locale]);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = locale === 'ar' ? 'rtl' : 'ltr';
    html.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(LOCALE_KEY, locale);
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [locale, theme]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  const refreshListsAndEnsureDossier = useCallback(async (preferredId?: string) => {
    const [listRes, profList] = await Promise.all([listDossiers(), listProfilesApi()]);
    setDossiers(listRes.dossiers);
    setProfiles(profList);

    const targetId = preferredId || listRes.dossiers[0]?.id;
    if (targetId) {
      const bundle = await getDossier(targetId);
      setActiveBundle(bundle);
      setDraftDossier(recomputeLocalDossierMetrics(bundle.dossier));
    } else {
      const created = await createDossierFromPresetApi('saas-copilot-compliant', 'en');
      const reloaded = await listDossiers();
      setDossiers(reloaded.dossiers);
      setActiveBundle(created);
      setDraftDossier(recomputeLocalDossierMetrics(created.dossier));
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      const [health, presetList] = await Promise.all([detectServerHealth(), fetchPresets()]);
      if (!active) return;
      setServerOnline(health.online);
      setPresets(presetList);

      if (publicSlugOrNum) {
        try {
          const pub = await getPublicDossier(publicSlugOrNum);
          if (!active) return;
          setActiveBundle(pub);
          setDraftDossier(recomputeLocalDossierMetrics(pub.dossier));
          setPublicNotFound(false);
        } catch {
          if (active) setPublicNotFound(true);
        }
        return;
      }

      await refreshListsAndEnsureDossier();
    }
    void bootstrap();
    return () => {
      active = false;
    };
  }, [publicSlugOrNum, refreshListsAndEnsureDossier]);

  const liveAudit = useMemo(
    () =>
      auditAiTransparencyAndLiteracy(
        draftDossier.organization,
        draftDossier.features,
        draftDossier.trainingRecords,
      ),
    [draftDossier.organization, draftDossier.features, draftDossier.trainingRecords],
  );

  const liveSummary = useMemo(
    () =>
      computeAiDiscloseSummary(
        liveAudit,
        draftDossier.controls,
        draftDossier.referenceDate || draftDossier.updatedAt,
      ),
    [liveAudit, draftDossier.controls, draftDossier.referenceDate, draftDossier.updatedAt],
  );

  async function handleSelectDossier(id: string) {
    const bundle = await getDossier(id);
    setActiveBundle(bundle);
    setDraftDossier(recomputeLocalDossierMetrics(bundle.dossier));
  }

  async function handleCreatePreset(presetId: AiDisclosePresetId) {
    const bundle = await createDossierFromPresetApi(presetId, locale);
    const listRes = await listDossiers();
    setDossiers(listRes.dossiers);
    setActiveBundle(bundle);
    setDraftDossier(recomputeLocalDossierMetrics(bundle.dossier));
    setActiveTab('surfaces');
  }

  async function handleSaveDraft() {
    if (draftDossier.status === 'locked') return;
    setSaving(true);
    try {
      const saved = await saveDossierDraft(draftDossier);
      const listRes = await listDossiers();
      setDossiers(listRes.dossiers);
      setActiveBundle(saved);
      setDraftDossier(recomputeLocalDossierMetrics(saved.dossier));
      showToast(copy.notices.draftSaved);
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalizeDossier() {
    setSealing(true);
    try {
      if (draftDossier.status === 'draft') {
        await saveDossierDraft(draftDossier);
      }
      const locked = await finalizeDossierApi(draftDossier.id);
      const listRes = await listDossiers();
      setDossiers(listRes.dossiers);
      setActiveBundle(locked);
      setDraftDossier(recomputeLocalDossierMetrics(locked.dossier));
      setActiveTab('dossier');
      showToast(copy.notices.dossierSealed);
    } finally {
      setSealing(false);
    }
  }

  async function handleDuplicateDossier() {
    const cloned = await duplicateDossierApi(draftDossier.id);
    const listRes = await listDossiers();
    setDossiers(listRes.dossiers);
    setActiveBundle(cloned);
    setDraftDossier(recomputeLocalDossierMetrics(cloned.dossier));
    setActiveTab('surfaces');
  }

  async function handleDeleteDraft(id: string) {
    await deleteDossierApi(id);
    await refreshListsAndEnsureDossier();
  }

  async function handleSaveProfile(org: OrganizationAiProfile) {
    await createProfileApi(org);
    setProfiles(await listProfilesApi());
    showToast(copy.notices.profileSaved);
  }

  async function handleDeleteProfile(id: string) {
    await deleteProfileApi(id);
    setProfiles(await listProfilesApi());
  }

  function handleOpenPublicReport() {
    const key = draftDossier.dossierNumber || draftDossier.slug || draftDossier.id;
    window.history.pushState({}, '', withBase(`/r/${encodeURIComponent(key)}`));
    setPublicNotFound(false);
    setPublicSlugOrNum(key);
  }

  function handleBackToWorkspace() {
    window.history.pushState({}, '', withBase('/'));
    setPublicSlugOrNum(null);
    setPublicNotFound(false);
    void refreshListsAndEnsureDossier();
  }

  const isLocked = draftDossier.status === 'locked';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky Top Header */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md no-print"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 88%, transparent)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
            >
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-extrabold aid-display tracking-tight">{copy.brandName}</h1>
                <span
                  className="aid-mono text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
                  dir="ltr"
                >
                  {copy.regulationBadge}
                </span>
              </div>
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                {copy.tagline}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              data-testid="storage-mode-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold border whitespace-nowrap"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-canvas)',
                color: 'var(--text-secondary)',
              }}
            >
              {serverOnline ? <Database className="w-3.5 h-3.5" /> : <HardDrive className="w-3.5 h-3.5" />}
              <span>{serverOnline ? copy.modeServer : copy.modeBrowser}</span>
            </span>

            <button
              type="button"
              data-testid="toggle-theme-btn"
              onClick={() => setTheme(theme === 'veridian' ? 'carbon-violet' : 'veridian')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer whitespace-nowrap"
              style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-elevated)' }}
            >
              {theme === 'veridian' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              <span>{theme === 'veridian' ? copy.themeCarbon : copy.themeVeridian}</span>
            </button>

            <button
              type="button"
              data-testid="toggle-locale-btn"
              onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{copy.langSwitch}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 space-y-6">
        {toast && (
          <div
            role="status"
            className="rounded-xl px-4 py-2.5 text-xs font-bold flex items-center gap-2 border no-print"
            style={{
              backgroundColor: 'var(--accent-emerald-soft)',
              color: 'var(--accent-emerald)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {publicSlugOrNum ? (
          publicNotFound ? (
            <div className="aid-card rounded-2xl p-8 text-center space-y-4">
              <p className="text-sm font-semibold">{copy.reportSection.publicNotFound}</p>
              <button
                type="button"
                onClick={handleBackToWorkspace}
                className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
                style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
              >
                {copy.actions.backToWorkspace}
              </button>
            </div>
          ) : (
            <DossierPreviewAndPrint
              dossier={draftDossier}
              audit={liveAudit}
              summary={liveSummary}
              viewCount={activeBundle?.viewCount ?? 0}
              publicReportUrl={activeBundle?.publicReportUrl}
              locale={locale}
              copy={copy}
              sealing={false}
              isPublicView
              onOpenWorkspace={handleBackToWorkspace}
            />
          )
        ) : (
          <>
            {/* Enforcement Timeline & Presets Strip */}
            <section className="space-y-3 no-print">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  {copy.presetsTitle}
                </span>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span
                    className="px-2.5 py-0.5 rounded-full whitespace-nowrap"
                    style={{
                      backgroundColor: liveSummary.isArt4Enforced
                        ? 'var(--accent-emerald-soft)'
                        : 'var(--bg-elevated)',
                      color: liveSummary.isArt4Enforced ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                    }}
                  >
                    {copy.timeline.art4Title} ·{' '}
                    {liveSummary.isArt4Enforced ? copy.timeline.enforcedTag : copy.timeline.upcomingTag}
                  </span>
                  <span
                    className="px-2.5 py-0.5 rounded-full whitespace-nowrap"
                    style={{
                      backgroundColor: liveSummary.isArt50Enforced
                        ? 'var(--accent-emerald-soft)'
                        : 'var(--accent-amber-soft)',
                      color: liveSummary.isArt50Enforced ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                    }}
                  >
                    {copy.timeline.art50Title} ·{' '}
                    {liveSummary.isArt50Enforced ? copy.timeline.enforcedTag : copy.timeline.upcomingTag}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`preset-btn-${preset.id}`}
                    onClick={() => void handleCreatePreset(preset.id)}
                    className="aid-card rounded-2xl p-4 text-start hover:border-indigo-400 transition cursor-pointer flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs font-extrabold aid-display" dir="auto">
                        {locale === 'ar' ? preset.titleAr : preset.titleEn}
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }} dir="auto">
                        {locale === 'ar' ? preset.subtitleAr : preset.subtitleEn}
                      </p>
                    </div>
                    <PlusCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--accent-primary)' }} />
                  </button>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left Sidebar: Saved Dossiers + Live Score Summary */}
              <aside className="xl:col-span-3 space-y-4 no-print">
                <div className="aid-card rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                      {copy.kpis.overall}
                    </span>
                    <span
                      className="aid-mono text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap"
                      style={{
                        backgroundColor:
                          liveSummary.readinessTier === 'ready'
                            ? 'var(--accent-emerald-soft)'
                            : liveSummary.readinessTier === 'needs_remediation'
                              ? 'var(--accent-amber-soft)'
                              : 'var(--accent-crimson-soft)',
                        color:
                          liveSummary.readinessTier === 'ready'
                            ? 'var(--accent-emerald)'
                            : liveSummary.readinessTier === 'needs_remediation'
                              ? 'var(--accent-amber)'
                              : 'var(--accent-crimson)',
                      }}
                    >
                      {copy.tierLabels[liveSummary.readinessTier]}
                    </span>
                  </div>

                  <div className="text-3xl font-extrabold aid-mono num-tabular" data-testid="live-overall-score" dir="ltr">
                    {liveSummary.overallScore}/100
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg p-2" style={{ backgroundColor: 'var(--bg-canvas)' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>{copy.kpis.disclosure}</div>
                      <div className="aid-mono font-bold num-tabular" dir="ltr">
                        {liveAudit.disclosureScore}/100
                      </div>
                    </div>
                    <div className="rounded-lg p-2" style={{ backgroundColor: 'var(--bg-canvas)' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>{copy.kpis.literacy}</div>
                      <div className="aid-mono font-bold num-tabular" dir="ltr">
                        {liveAudit.literacyCompletionPct}%
                      </div>
                    </div>
                    <div className="rounded-lg p-2" style={{ backgroundColor: 'var(--bg-canvas)' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>{copy.kpis.blockingGaps}</div>
                      <div className="aid-mono font-bold num-tabular" dir="ltr">
                        {liveSummary.blockingGapsCount}
                      </div>
                    </div>
                    <div className="rounded-lg p-2" style={{ backgroundColor: 'var(--bg-canvas)' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>{copy.kpis.editorialExemptions}</div>
                      <div className="aid-mono font-bold num-tabular" dir="ltr">
                        {liveAudit.editorialExemptionsUsed}
                      </div>
                    </div>
                  </div>

                  {!isLocked ? (
                    <button
                      type="button"
                      data-testid="save-draft-btn"
                      disabled={saving}
                      onClick={() => void handleSaveDraft()}
                      className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: 'var(--accent-primary-fg)',
                      }}
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? copy.actions.saving : copy.actions.saveDraft}</span>
                    </button>
                  ) : (
                    <div
                      className="rounded-xl p-3 text-[11px] font-medium flex items-start gap-2"
                      style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                    >
                      <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{copy.reportSection.readOnlyLockedNotice}</span>
                    </div>
                  )}
                </div>

                <div className="aid-card rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <FileCheck2 className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                      <span>{copy.dossiersTitle}</span>
                    </span>
                    <span className="aid-mono num-tabular" dir="ltr">
                      {dossiers.length}
                    </span>
                  </div>

                  {dossiers.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {copy.noDossiersYet}
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                      {dossiers.map((rec) => {
                        const isSelected = rec.id === draftDossier.id;
                        return (
                          <div
                            key={rec.id}
                            className="rounded-xl border p-2.5 flex items-center justify-between gap-2 transition"
                            style={{
                              borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)',
                              backgroundColor: isSelected ? 'var(--bg-soft)' : 'var(--bg-canvas)',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => void handleSelectDossier(rec.id)}
                              className="text-start min-w-0 flex-1 cursor-pointer"
                            >
                              <div className="text-xs font-bold truncate" dir="auto">
                                {rec.dossier.organization.legalName}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="aid-mono text-[10px]" style={{ color: 'var(--text-secondary)' }} dir="ltr">
                                  {rec.dossierNumber || rec.slug}
                                </span>
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.2 rounded whitespace-nowrap"
                                  style={{
                                    backgroundColor:
                                      rec.status === 'locked'
                                        ? 'var(--accent-emerald-soft)'
                                        : 'var(--bg-elevated)',
                                    color:
                                      rec.status === 'locked'
                                        ? 'var(--accent-emerald)'
                                        : 'var(--text-secondary)',
                                  }}
                                >
                                  {rec.status === 'locked' ? copy.lockedStatus : copy.draftStatus}
                                </span>
                              </div>
                            </button>

                            {rec.status === 'draft' && dossiers.length > 1 && (
                              <button
                                type="button"
                                aria-label={copy.actions.deleteDraft}
                                onClick={() => void handleDeleteDraft(rec.id)}
                                className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
                                style={{ color: 'var(--accent-crimson)' }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </aside>

              {/* Main Workspace Panel */}
              <div className="xl:col-span-9 space-y-5">
                <nav
                  aria-label="Workspace Sections"
                  className="aid-card rounded-2xl p-1.5 flex flex-wrap gap-1.5 no-print"
                >
                  {(
                    [
                      { id: 'surfaces', label: copy.tabs.surfaces },
                      { id: 'literacy', label: copy.tabs.literacyAndCsv },
                      { id: 'dossier', label: copy.tabs.dossierAndPrint },
                    ] as const
                  ).map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        data-testid={`tab-${tab.id}`}
                        onClick={() => setActiveTab(tab.id)}
                        className="flex-1 min-w-[160px] px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
                        style={
                          active
                            ? {
                                backgroundColor: 'var(--accent-primary)',
                                color: 'var(--accent-primary-fg)',
                              }
                            : {
                                backgroundColor: 'transparent',
                                color: 'var(--text-secondary)',
                              }
                        }
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>

                {activeTab === 'surfaces' && (
                  <OrganizationAndFeaturesPanel
                    dossier={draftDossier}
                    audit={liveAudit}
                    profiles={profiles}
                    locale={locale}
                    copy={copy}
                    disabled={isLocked}
                    onChange={setDraftDossier}
                    onSaveProfile={handleSaveProfile}
                    onDeleteProfile={handleDeleteProfile}
                  />
                )}

                {activeTab === 'literacy' && (
                  <LiteracyAndBatchPanel
                    dossier={draftDossier}
                    audit={liveAudit}
                    locale={locale}
                    copy={copy}
                    disabled={isLocked}
                    onChange={setDraftDossier}
                  />
                )}

                {activeTab === 'dossier' && (
                  <DossierPreviewAndPrint
                    dossier={draftDossier}
                    audit={liveAudit}
                    summary={liveSummary}
                    viewCount={activeBundle?.viewCount ?? 0}
                    publicReportUrl={activeBundle?.publicReportUrl}
                    locale={locale}
                    copy={copy}
                    sealing={sealing}
                    onFinalize={handleFinalizeDossier}
                    onDuplicate={handleDuplicateDossier}
                    onOpenPublicReport={handleOpenPublicReport}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
