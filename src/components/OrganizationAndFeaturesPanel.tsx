import { useState } from 'react';
import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AI_SURFACE_META, MARKING_STANDARD_LABELS } from '../core/aiActRules.ts';
import { buildArticle50NoticeHtmlSnippet } from '../core/noticeAndLiteracy.ts';
import type {
  AiDiscloseDossier,
  AiFeatureInventoryItem,
  AiOperatorRole,
  AiSystemSurface,
  Locale,
  MarkingStandard,
  OrganizationAiProfile,
  TransparencyAuditReport,
} from '../core/types.ts';
import type { OrgProfileRecord } from '../lib/api.ts';
import type { UiCopy } from '../lib/i18n.ts';

interface OrganizationAndFeaturesPanelProps {
  dossier: AiDiscloseDossier;
  audit: TransparencyAuditReport;
  profiles: OrgProfileRecord[];
  locale: Locale;
  copy: UiCopy;
  disabled: boolean;
  onChange: (next: AiDiscloseDossier) => void;
  onSaveProfile: (org: OrganizationAiProfile) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
}

function downloadBlobFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function OrganizationAndFeaturesPanel({
  dossier,
  audit,
  profiles,
  locale,
  copy,
  disabled,
  onChange,
  onSaveProfile,
  onDeleteProfile,
}: OrganizationAndFeaturesPanelProps) {
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const snippetHtml = buildArticle50NoticeHtmlSnippet(dossier, locale);

  function updateOrg<K extends keyof OrganizationAiProfile>(
    key: K,
    value: OrganizationAiProfile[K],
  ) {
    onChange({
      ...dossier,
      organization: {
        ...dossier.organization,
        [key]: value,
      },
    });
  }

  function updateFeature(index: number, patch: Partial<AiFeatureInventoryItem>) {
    const nextFeatures = dossier.features.map((feat, idx) =>
      idx === index ? { ...feat, ...patch } : feat,
    );
    onChange({
      ...dossier,
      features: nextFeatures,
    });
  }

  function handleAddFeature() {
    const nextNum = dossier.features.length + 1;
    const newItem: AiFeatureInventoryItem = {
      id: `FEAT-${String(nextNum).padStart(2, '0')}`,
      featureName: locale === 'ar' ? `ميزة ذكاء اصطناعي ${nextNum}` : `AI Assistant Surface ${nextNum}`,
      surface: 'interactive_chatbot',
      providerName: dossier.organization.legalName || 'Internal Provider',
      modelName: 'Custom-Model-v1',
      publicFacingSinceIso: new Date().toISOString().slice(0, 10),
      disclosureBannerVisible: true,
      disclosureWordingEn: 'This feature uses artificial intelligence to assist users.',
      disclosureWordingAr: 'تستخدم هذه الميزة الذكاء الاصطناعي لمساعدة المستخدمين.',
      machineReadableMarking: 'html_meta_tag',
      wcagAccessibleNotice: true,
      interactiveObviousException: false,
      humanEditorialResponsibilityVerified: false,
    };
    onChange({
      ...dossier,
      features: [...dossier.features, newItem],
    });
  }

  function handleRemoveFeature(index: number) {
    onChange({
      ...dossier,
      features: dossier.features.filter((_, idx) => idx !== index),
    });
  }

  async function handleCopySnippet() {
    try {
      await navigator.clipboard.writeText(snippetHtml);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 1800);
    } catch {
      // clipboard fallback ignored
    }
  }

  async function handleSaveOrgProfile() {
    setSavingProfile(true);
    try {
      await onSaveProfile(dossier.organization);
    } finally {
      setSavingProfile(false);
    }
  }

  const markingEntries = Object.entries(MARKING_STANDARD_LABELS) as Array<
    [MarkingStandard, { en: string; ar: string }]
  >;

  return (
    <div className="space-y-6">
      {/* Organization Governance Identity Card */}
      <section className="aid-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-base sm:text-lg font-bold aid-display">{copy.orgSection.title}</h2>
          </div>

          <button
            type="button"
            data-testid="save-org-profile-btn"
            disabled={disabled || savingProfile}
            onClick={handleSaveOrgProfile}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer disabled:opacity-50"
            style={{
              borderColor: 'var(--border-strong)',
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
            }}
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">{copy.orgSection.saveProfileBtn}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              {copy.orgSection.legalName}
            </label>
            <input
              type="text"
              dir="auto"
              data-testid="org-legal-name"
              disabled={disabled}
              value={dossier.organization.legalName}
              onChange={(e) => updateOrg('legalName', e.target.value)}
              className="aid-input"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              {copy.orgSection.contactEmail}
            </label>
            <input
              type="email"
              dir="ltr"
              data-testid="org-contact-email"
              disabled={disabled}
              value={dossier.organization.contactEmail}
              onChange={(e) => updateOrg('contactEmail', e.target.value)}
              className="aid-input aid-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              {copy.orgSection.dpoOrGovLead}
            </label>
            <input
              type="text"
              dir="auto"
              data-testid="org-gov-lead"
              disabled={disabled}
              value={dossier.organization.dpoOrGovLead}
              onChange={(e) => updateOrg('dpoOrGovLead', e.target.value)}
              className="aid-input"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              {copy.orgSection.countryCode}
            </label>
            <input
              type="text"
              dir="ltr"
              maxLength={4}
              data-testid="org-country-code"
              disabled={disabled}
              value={dossier.organization.countryCode}
              onChange={(e) => updateOrg('countryCode', e.target.value.toUpperCase())}
              className="aid-input aid-mono uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              {copy.orgSection.operatorRole}
            </label>
            <select
              data-testid="org-operator-role"
              disabled={disabled}
              value={dossier.organization.operatorRole}
              onChange={(e) => updateOrg('operatorRole', e.target.value as AiOperatorRole)}
              className="aid-input"
            >
              {(['provider', 'deployer', 'both'] as const).map((role) => (
                <option key={role} value={role}>
                  {copy.orgSection.roleOptions[role]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              {copy.orgSection.governancePolicyUrl}
            </label>
            <input
              type="url"
              dir="ltr"
              data-testid="org-policy-url"
              disabled={disabled}
              value={dossier.organization.governancePolicyUrl ?? ''}
              onChange={(e) => updateOrg('governancePolicyUrl', e.target.value)}
              placeholder="https://company.eu/ai-transparency"
              className="aid-input aid-mono text-xs"
            />
          </div>
        </div>

        {profiles.length > 0 && (
          <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="text-xs font-semibold mb-2.5" style={{ color: 'var(--text-secondary)' }}>
              {copy.orgSection.savedProfiles} ({profiles.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {profiles.map((prof) => (
                <div
                  key={prof.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs"
                  style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}
                >
                  <span className="font-semibold" dir="auto">
                    {prof.profile.legalName}
                  </span>
                  <span className="aid-mono text-[11px]" style={{ color: 'var(--text-secondary)' }} dir="ltr">
                    {prof.profile.countryCode}
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange({ ...dossier, organization: { ...prof.profile } })}
                    className="font-semibold underline cursor-pointer disabled:opacity-40"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    {copy.orgSection.applyProfile}
                  </button>
                  <button
                    type="button"
                    aria-label={copy.orgSection.deleteProfile}
                    onClick={() => onDeleteProfile(prof.id)}
                    className="opacity-70 hover:opacity-100 cursor-pointer"
                    style={{ color: 'var(--accent-crimson)' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* AI Feature & Surface Inventory Editor */}
      <section className="aid-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-base sm:text-lg font-bold aid-display">{copy.featuresSection.title}</h2>
          </div>

          <button
            type="button"
            data-testid="add-feature-btn"
            disabled={disabled}
            onClick={handleAddFeature}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
          >
            <Plus className="w-4 h-4" />
            <span className="whitespace-nowrap">{copy.featuresSection.addFeature}</span>
          </button>
        </div>

        <div className="space-y-4">
          {dossier.features.map((feat, idx) => (
            <div
              key={`${feat.id}-${idx}`}
              data-testid={`feature-card-${idx}`}
              className="rounded-xl border p-4 space-y-4"
              style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-canvas)' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="aid-mono text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap shrink-0"
                    style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--accent-primary)' }}
                    dir="ltr"
                  >
                    {feat.id}
                  </span>
                  <span className="font-bold text-sm" dir="auto">
                    {feat.featureName}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleRemoveFeature(idx)}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-40"
                  style={{ color: 'var(--accent-crimson)', backgroundColor: 'var(--accent-crimson-soft)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{copy.featuresSection.deleteFeature}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {copy.featuresSection.featureName}
                  </label>
                  <input
                    type="text"
                    dir="auto"
                    disabled={disabled}
                    value={feat.featureName}
                    onChange={(e) => updateFeature(idx, { featureName: e.target.value })}
                    className="aid-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {copy.featuresSection.surface}
                  </label>
                  <select
                    disabled={disabled}
                    value={feat.surface}
                    onChange={(e) => updateFeature(idx, { surface: e.target.value as AiSystemSurface })}
                    className="aid-input"
                  >
                    {AI_SURFACE_META.map((meta) => (
                      <option key={meta.id} value={meta.id}>
                        {meta.articleRef} — {locale === 'ar' ? meta.labelAr : meta.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {copy.featuresSection.machineReadableMarking}
                  </label>
                  <select
                    data-testid={`feature-marking-select-${idx}`}
                    disabled={disabled}
                    value={feat.machineReadableMarking}
                    onChange={(e) =>
                      updateFeature(idx, { machineReadableMarking: e.target.value as MarkingStandard })
                    }
                    className="aid-input"
                  >
                    {markingEntries.map(([val, labels]) => (
                      <option key={val} value={val}>
                        {locale === 'ar' ? labels.ar : labels.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {copy.featuresSection.providerName}
                  </label>
                  <input
                    type="text"
                    dir="auto"
                    disabled={disabled}
                    value={feat.providerName}
                    onChange={(e) => updateFeature(idx, { providerName: e.target.value })}
                    className="aid-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {copy.featuresSection.modelName}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    disabled={disabled}
                    value={feat.modelName}
                    onChange={(e) => updateFeature(idx, { modelName: e.target.value })}
                    className="aid-input aid-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {copy.featuresSection.publicFacingSince}
                  </label>
                  <input
                    type="date"
                    dir="ltr"
                    disabled={disabled}
                    value={feat.publicFacingSinceIso}
                    onChange={(e) => updateFeature(idx, { publicFacingSinceIso: e.target.value })}
                    className="aid-input aid-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {copy.featuresSection.disclosureWordingEn}
                  </label>
                  <textarea
                    rows={2}
                    dir="ltr"
                    data-testid={`feature-wording-en-${idx}`}
                    disabled={disabled}
                    value={feat.disclosureWordingEn}
                    onChange={(e) => updateFeature(idx, { disclosureWordingEn: e.target.value })}
                    className="aid-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {copy.featuresSection.disclosureWordingAr}
                  </label>
                  <textarea
                    rows={2}
                    dir="rtl"
                    disabled={disabled}
                    value={feat.disclosureWordingAr}
                    onChange={(e) => updateFeature(idx, { disclosureWordingAr: e.target.value })}
                    className="aid-input text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <label className="inline-flex items-start gap-2.5 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid={`feature-banner-checkbox-${idx}`}
                    checked={feat.disclosureBannerVisible}
                    disabled={disabled}
                    onChange={(e) => updateFeature(idx, { disclosureBannerVisible: e.target.checked })}
                    className="mt-0.5 rounded accent-indigo-600"
                  />
                  <span>{copy.featuresSection.disclosureBannerVisible}</span>
                </label>

                <label className="inline-flex items-start gap-2.5 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid={`feature-wcag-checkbox-${idx}`}
                    checked={feat.wcagAccessibleNotice}
                    disabled={disabled}
                    onChange={(e) => updateFeature(idx, { wcagAccessibleNotice: e.target.checked })}
                    className="mt-0.5 rounded accent-indigo-600"
                  />
                  <span>{copy.featuresSection.wcagAccessibleNotice}</span>
                </label>

                {feat.surface === 'interactive_chatbot' && (
                  <label className="inline-flex items-start gap-2.5 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={feat.interactiveObviousException}
                      disabled={disabled}
                      onChange={(e) => updateFeature(idx, { interactiveObviousException: e.target.checked })}
                      className="mt-0.5 rounded accent-indigo-600"
                    />
                    <span>{copy.featuresSection.interactiveObviousException}</span>
                  </label>
                )}

                {feat.surface === 'public_interest_text' && (
                  <div
                    className="rounded-xl p-3 border space-y-2.5 mt-1"
                    style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}
                  >
                    <label className="inline-flex items-start gap-2.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        data-testid={`editorial-exempt-checkbox-${idx}`}
                        checked={feat.humanEditorialResponsibilityVerified}
                        disabled={disabled}
                        onChange={(e) =>
                          updateFeature(idx, {
                            humanEditorialResponsibilityVerified: e.target.checked,
                          })
                        }
                        className="mt-0.5 rounded accent-indigo-600"
                      />
                      <span>{copy.featuresSection.humanEditorialVerified}</span>
                    </label>
                    {feat.humanEditorialResponsibilityVerified && (
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                          {copy.featuresSection.editorialOwnerName}
                        </label>
                        <input
                          type="text"
                          dir="auto"
                          data-testid={`editorial-owner-input-${idx}`}
                          disabled={disabled}
                          value={feat.editorialOwnerName ?? ''}
                          onChange={(e) => updateFeature(idx, { editorialOwnerName: e.target.value })}
                          placeholder={locale === 'ar' ? 'مثال: رئيس التحرير المناوب' : 'e.g. Managing Newsroom Editor'}
                          className="aid-input text-xs"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Grid: Live Compliance Findings + Art. 50 HTML / JSON-LD Snippet Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="aid-card rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-sm sm:text-base font-bold aid-display flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--accent-amber)' }} />
              <span>{copy.featuresSection.issuesTitle}</span>
            </h3>
            <span
              dir="ltr"
              className="aid-mono text-xs font-semibold px-2.5 py-0.5 rounded-full num-tabular whitespace-nowrap shrink-0"
              style={{
                backgroundColor:
                  audit.errorsCount > 0 ? 'var(--accent-crimson-soft)' : 'var(--accent-emerald-soft)',
                color: audit.errorsCount > 0 ? 'var(--accent-crimson)' : 'var(--accent-emerald)',
              }}
            >
              {audit.errorsCount}E / {audit.warningsCount}W
            </span>
          </div>

          {audit.issues.length === 0 ? (
            <div
              className="rounded-xl p-4 flex items-center gap-3 text-sm font-medium"
              style={{ backgroundColor: 'var(--accent-emerald-soft)', color: 'var(--accent-emerald)' }}
            >
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{copy.featuresSection.noIssues}</span>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {audit.issues.map((issue, idx) => {
                const isError = issue.severity === 'error';
                return (
                  <li
                    key={`${issue.code}-${idx}`}
                    className="rounded-xl p-3 border text-xs space-y-1"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: isError ? 'var(--accent-crimson-soft)' : 'var(--accent-amber-soft)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="aid-mono font-bold"
                        style={{ color: isError ? 'var(--accent-crimson)' : 'var(--accent-amber)' }}
                        dir="ltr"
                      >
                        {issue.code}
                      </span>
                      <span
                        className="aid-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-white/70 dark:bg-black/30 whitespace-nowrap"
                        dir="ltr"
                      >
                        {issue.articleRef}
                      </span>
                    </div>
                    <p className="font-medium leading-relaxed" dir="auto">
                      {locale === 'ar' ? issue.messageAr : issue.messageEn}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="aid-card rounded-2xl p-5 sm:p-6 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm sm:text-base font-bold aid-display flex items-center gap-2">
              <Code2 className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <span>{copy.featuresSection.snippetTitle}</span>
            </h3>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="copy-art50-html-btn"
                onClick={handleCopySnippet}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer"
                style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-elevated)' }}
              >
                {copiedSnippet ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSnippet ? copy.featuresSection.copied : copy.featuresSection.copySnippet}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadBlobFile(
                    `aidisclose-${dossier.dossierNumber || dossier.slug || 'draft'}-article50.html`,
                    snippetHtml,
                    'text/html; charset=utf-8',
                  )
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{copy.featuresSection.downloadHtml}</span>
              </button>
            </div>
          </div>

          <pre
            dir="ltr"
            data-testid="art50-snippet-pre"
            className="aid-mono text-[11px] leading-relaxed p-3.5 rounded-xl border overflow-x-auto flex-1 max-h-72"
            style={{
              borderColor: 'var(--border-subtle)',
              backgroundColor: 'var(--bg-canvas)',
              color: 'var(--text-primary)',
            }}
          >
            {snippetHtml}
          </pre>
        </section>
      </div>
    </div>
  );
}
