import { useEffect, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  CopyPlus,
  Download,
  FileText,
  Lock,
  Printer,
  Share2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  AIDISCLOSE_LEGAL_DISCLAIMER_AR,
  AIDISCLOSE_LEGAL_DISCLAIMER_EN,
  EU_AI_ACT_CODE,
  MARKING_STANDARD_LABELS,
} from '../core/aiActRules.ts';
import { exportAiInventoryCsv } from '../core/disclosureAuditor.ts';
import { verifyDossierIntegrity } from '../core/dossierDigest.ts';
import {
  buildArticle4LiteracyRegisterMarkdown,
  buildArticle50NoticeHtmlSnippet,
} from '../core/noticeAndLiteracy.ts';
import type {
  AiDiscloseDossier,
  AiDiscloseSummary,
  InventoryCsvAuditReport,
  Locale,
  TransparencyAuditReport,
} from '../core/types.ts';
import type { UiCopy } from '../lib/i18n.ts';

interface DossierPreviewAndPrintProps {
  dossier: AiDiscloseDossier;
  audit: TransparencyAuditReport;
  summary: AiDiscloseSummary;
  viewCount: number;
  publicReportUrl?: string;
  locale: Locale;
  copy: UiCopy;
  sealing: boolean;
  isPublicView?: boolean;
  onFinalize?: () => Promise<void>;
  onDuplicate?: () => Promise<void>;
  onOpenPublicReport?: () => void;
  onOpenWorkspace?: () => void;
}

function downloadTextAsset(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildDossierInventoryCsv(
  dossier: AiDiscloseDossier,
  audit: TransparencyAuditReport,
  locale: Locale,
): string {
  const report: InventoryCsvAuditReport = {
    totalRows: dossier.features.length,
    passedRows: 0,
    failedRows: 0,
    averageScore: audit.disclosureScore,
    rows: dossier.features.map((feat, idx) => {
      const featIssues = audit.issues.filter((i) => i.featureId === feat.id);
      const editorialExemption =
        feat.surface === 'public_interest_text' &&
        feat.humanEditorialResponsibilityVerified &&
        Boolean((feat.editorialOwnerName || '').trim());
      const failed = featIssues.some((i) => i.severity === 'error');
      return {
        rowNumber: idx + 2,
        featureId: feat.id,
        featureName: feat.featureName,
        surface: feat.surface,
        disclosureBanner:
          feat.disclosureBannerVisible ||
          (feat.surface === 'interactive_chatbot' && feat.interactiveObviousException),
        machineReadable: feat.machineReadableMarking,
        wcagAccessible: feat.wcagAccessibleNotice,
        editorialExemption,
        status: failed ? 'fail' : 'pass',
        score: editorialExemption || !failed ? 100 : 40,
        issues: featIssues,
      };
    }),
  };
  return exportAiInventoryCsv(report, locale);
}

export default function DossierPreviewAndPrint({
  dossier,
  audit,
  summary,
  viewCount,
  publicReportUrl,
  locale,
  copy,
  sealing,
  isPublicView = false,
  onFinalize,
  onDuplicate,
  onOpenPublicReport,
  onOpenWorkspace,
}: DossierPreviewAndPrintProps) {
  const [integrityValid, setIntegrityValid] = useState<boolean | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let active = true;
    if (dossier.status !== 'locked' || !dossier.scopeDigestHex) {
      setIntegrityValid(null);
      return;
    }
    void verifyDossierIntegrity(dossier).then((res) => {
      if (active) setIntegrityValid(res.valid);
    });
    return () => {
      active = false;
    };
  }, [dossier]);

  const isLocked = dossier.status === 'locked';
  const fileBase = dossier.dossierNumber || dossier.slug || dossier.id;
  const art50Html = buildArticle50NoticeHtmlSnippet(dossier, locale);
  const art4Markdown = buildArticle4LiteracyRegisterMarkdown(dossier, locale);

  async function handleCopyShareUrl() {
    if (!publicReportUrl) return;
    try {
      await navigator.clipboard.writeText(publicReportUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  }

  const tierStyle =
    summary.readinessTier === 'ready'
      ? { bg: 'var(--accent-emerald-soft)', color: 'var(--accent-emerald)' }
      : summary.readinessTier === 'needs_remediation'
        ? { bg: 'var(--accent-amber-soft)', color: 'var(--accent-amber)' }
        : { bg: 'var(--accent-crimson-soft)', color: 'var(--accent-crimson)' };

  return (
    <div className="space-y-6">
      {/* Control & Export Actions Bar (Hidden on Print) */}
      <div className="aid-card rounded-2xl p-4 sm:p-5 no-print space-y-4">
        {isPublicView && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap"
              style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copy.reportSection.publicSharedBanner}</span>
            </span>
            {onOpenWorkspace && (
              <button
                type="button"
                data-testid="back-to-workspace-btn"
                onClick={onOpenWorkspace}
                className="text-xs font-bold underline cursor-pointer"
                style={{ color: 'var(--accent-primary)' }}
              >
                {copy.actions.backToWorkspace}
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          {!isPublicView && !isLocked && onFinalize && (
            <button
              type="button"
              data-testid="finalize-dossier-btn"
              disabled={sealing}
              onClick={() => void onFinalize()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
            >
              <Lock className="w-4 h-4" />
              <span className="whitespace-nowrap">
                {sealing ? copy.actions.sealing : copy.actions.finalizeSeal}
              </span>
            </button>
          )}

          {!isPublicView && isLocked && onDuplicate && (
            <button
              type="button"
              data-testid="duplicate-dossier-btn"
              onClick={() => void onDuplicate()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
            >
              <CopyPlus className="w-4 h-4" />
              <span className="whitespace-nowrap">{copy.actions.duplicateDraft}</span>
            </button>
          )}

          <button
            type="button"
            data-testid="print-pdf-btn"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer"
            style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-elevated)' }}
          >
            <Printer className="w-4 h-4" />
            <span className="whitespace-nowrap">{copy.actions.printPdf}</span>
          </button>

          {publicReportUrl && (
            <>
              <button
                type="button"
                data-testid="copy-share-link-btn"
                onClick={() => void handleCopyShareUrl()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer"
                style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-elevated)' }}
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span className="whitespace-nowrap">
                  {copiedLink ? copy.notices.linkCopied : copy.actions.copyShareLink}
                </span>
              </button>

              {!isPublicView && onOpenPublicReport && (
                <button
                  type="button"
                  data-testid="open-public-brief-btn"
                  onClick={onOpenPublicReport}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer"
                  style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-elevated)' }}
                >
                  <Share2 className="w-4 h-4" />
                  <span className="whitespace-nowrap">{copy.actions.openPublicReport}</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            data-testid="download-literacy-md-btn"
            onClick={() =>
              downloadTextAsset(
                `aidisclose-${fileBase}-article4-literacy-${locale}.md`,
                art4Markdown,
                'text/markdown; charset=utf-8',
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer"
            style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-surface)' }}
          >
            <FileText className="w-4 h-4" />
            <span className="whitespace-nowrap">{copy.actions.downloadMarkdown}</span>
          </button>

          <button
            type="button"
            data-testid="download-article50-html-btn"
            onClick={() =>
              downloadTextAsset(
                `aidisclose-${fileBase}-article50-${locale}.html`,
                art50Html,
                'text/html; charset=utf-8',
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer"
            style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-surface)' }}
          >
            <Code2 className="w-4 h-4" />
            <span className="whitespace-nowrap">{copy.actions.downloadHtml}</span>
          </button>

          <button
            type="button"
            data-testid="download-dossier-csv-btn"
            onClick={() =>
              downloadTextAsset(
                `aidisclose-${fileBase}-ai-inventory-${locale}.csv`,
                buildDossierInventoryCsv(dossier, audit, locale),
                'text/csv; charset=utf-8',
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer"
            style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-surface)' }}
          >
            <Download className="w-4 h-4" />
            <span className="whitespace-nowrap">{copy.actions.downloadCsv}</span>
          </button>
        </div>
      </div>

      {/* Printable / Shareable A4 Dossier Sheet */}
      <article className="aid-card rounded-2xl p-6 sm:p-8 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="aid-mono text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap"
                style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
                dir="ltr"
              >
                {EU_AI_ACT_CODE}
              </span>
              <span
                className="aid-mono text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap"
                style={{ backgroundColor: tierStyle.bg, color: tierStyle.color }}
              >
                {copy.tierLabels[summary.readinessTier]}
              </span>
              {viewCount > 0 && (
                <span
                  data-testid="public-view-count"
                  className="aid-mono text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {copy.viewsLabel}: {viewCount}
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold aid-display">{copy.reportSection.title}</h2>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }} dir="auto">
              {dossier.organization.legalName} — {dossier.organization.dpoOrGovLead}
            </p>
          </div>

          <div className="rounded-xl border p-3.5 min-w-[230px] space-y-1" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-canvas)' }}>
            <div className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {copy.reportSection.dossierNumberLabel}
            </div>
            <div data-testid="report-dossier-number" className="aid-mono text-base font-extrabold" dir="ltr">
              {dossier.dossierNumber || 'DRAFT'}
            </div>
            {dossier.scopeDigestHex ? (
              <div className="pt-1 space-y-0.5">
                <div className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {copy.reportSection.shaDigestLabel}
                </div>
                <div className="aid-mono text-[10px] break-all" dir="ltr" data-testid="report-digest-hex">
                  {dossier.scopeDigestHex}
                </div>
                {integrityValid !== null && (
                  <div
                    data-testid="digest-status-badge"
                    className="inline-flex items-center gap-1 text-[11px] font-bold pt-1"
                    style={{
                      color: integrityValid ? 'var(--accent-emerald)' : 'var(--accent-crimson)',
                    }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{copy.reportSection.integrityVerified}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {copy.reportSection.integrityDraft}
              </div>
            )}
          </div>
        </header>

        {/* Executive Readiness KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 print-avoid-break">
          <div className="rounded-xl p-3.5 border" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {copy.kpis.overall}
            </div>
            <div className="text-2xl font-extrabold aid-mono num-tabular mt-1" dir="ltr">
              {summary.overallScore}/100
            </div>
          </div>
          <div className="rounded-xl p-3.5 border" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {copy.kpis.disclosure}
            </div>
            <div className="text-2xl font-extrabold aid-mono num-tabular mt-1" dir="ltr">
              {audit.disclosureScore}/100
            </div>
          </div>
          <div className="rounded-xl p-3.5 border" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {copy.kpis.literacy}
            </div>
            <div className="text-2xl font-extrabold aid-mono num-tabular mt-1" dir="ltr">
              {audit.literacyCompletionPct}%
            </div>
          </div>
          <div className="rounded-xl p-3.5 border" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {copy.kpis.machineMarking}
            </div>
            <div className="text-2xl font-extrabold aid-mono num-tabular mt-1" dir="ltr">
              {audit.machineReadableScore}/100
            </div>
          </div>
        </div>

        {/* Article 50 Inventory Summary Table */}
        <div className="space-y-2.5 print-avoid-break">
          <h3 className="text-sm font-bold aid-display">{copy.reportSection.art50TableTitle}</h3>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
            <table className="w-full min-w-[600px] text-xs">
              <thead style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <tr className={locale === 'ar' ? 'text-right' : 'text-left'}>
                  <th className="px-3 py-2 font-bold">ID</th>
                  <th className="px-3 py-2 font-bold">{copy.featuresSection.featureName}</th>
                  <th className="px-3 py-2 font-bold">{copy.csvSection.colSurface}</th>
                  <th className="px-3 py-2 font-bold">{copy.csvSection.colMarking}</th>
                  <th className="px-3 py-2 font-bold">WCAG</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {dossier.features.map((feat) => {
                  const editorialExempt =
                    feat.surface === 'public_interest_text' &&
                    feat.humanEditorialResponsibilityVerified &&
                    Boolean((feat.editorialOwnerName || '').trim());
                  return (
                    <tr key={feat.id}>
                      <td className="px-3 py-2 aid-mono font-semibold whitespace-nowrap" dir="ltr">
                        {feat.id}
                      </td>
                      <td className="px-3 py-2 font-semibold" dir="auto">
                        <div>{feat.featureName}</div>
                        {editorialExempt && (
                          <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--accent-emerald)' }}>
                            Art. 50(4) Editorial Review: {feat.editorialOwnerName}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 aid-mono" dir="ltr">
                        {feat.surface}
                      </td>
                      <td className="px-3 py-2">
                        {locale === 'ar'
                          ? MARKING_STANDARD_LABELS[feat.machineReadableMarking].ar
                          : MARKING_STANDARD_LABELS[feat.machineReadableMarking].en}
                      </td>
                      <td className="px-3 py-2">
                        {feat.wcagAccessibleNotice ? copy.csvSection.yesLabel : copy.csvSection.noLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Article 4 Literacy Cohorts Summary Table */}
        <div className="space-y-2.5 print-avoid-break">
          <h3 className="text-sm font-bold aid-display">{copy.reportSection.art4TableTitle}</h3>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
            <table className="w-full min-w-[540px] text-xs">
              <thead style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <tr className={locale === 'ar' ? 'text-right' : 'text-left'}>
                  <th className="px-3 py-2 font-bold">ID</th>
                  <th className="px-3 py-2 font-bold">{copy.literacySection.teamOrRole}</th>
                  <th className="px-3 py-2 font-bold">{copy.literacySection.completedCount}</th>
                  <th className="px-3 py-2 font-bold">{copy.literacySection.curriculumTopics}</th>
                  <th className="px-3 py-2 font-bold">{copy.literacySection.lastSessionDate}</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {dossier.trainingRecords.map((rec) => (
                  <tr key={rec.id}>
                    <td className="px-3 py-2 aid-mono font-semibold" dir="ltr">
                      {rec.id}
                    </td>
                    <td className="px-3 py-2 font-semibold" dir="auto">
                      {rec.teamOrRole}
                    </td>
                    <td className="px-3 py-2 aid-mono num-tabular" dir="ltr">
                      {rec.completedCount}/{rec.staffCount}
                    </td>
                    <td className="px-3 py-2" dir="auto">
                      {rec.curriculumTopics.join(', ')}
                    </td>
                    <td className="px-3 py-2 aid-mono" dir="ltr">
                      {rec.lastSessionDateIso}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 10-Control Matrix Summary */}
        <div className="space-y-2.5 print-avoid-break">
          <h3 className="text-sm font-bold aid-display">{copy.reportSection.controlsTableTitle}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {dossier.controls.map((ctrl) => (
              <div
                key={ctrl.id}
                className="rounded-xl border p-3 text-xs flex items-start justify-between gap-2"
                style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-canvas)' }}
              >
                <div className="space-y-0.5">
                  <div className="aid-mono font-bold text-[11px]" style={{ color: 'var(--accent-primary)' }} dir="ltr">
                    {ctrl.articleRef}
                  </div>
                  <div className="font-semibold" dir="auto">
                    {locale === 'ar' ? ctrl.titleAr : ctrl.titleEn}
                  </div>
                  {ctrl.evidenceNote && (
                    <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }} dir="auto">
                      {ctrl.evidenceNote}
                    </div>
                  )}
                </div>
                <span
                  className="aid-mono text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
                  style={{
                    backgroundColor:
                      ctrl.status === 'pass'
                        ? 'var(--accent-emerald-soft)'
                        : ctrl.status === 'fail'
                          ? 'var(--accent-crimson-soft)'
                          : 'var(--bg-elevated)',
                    color:
                      ctrl.status === 'pass'
                        ? 'var(--accent-emerald)'
                        : ctrl.status === 'fail'
                          ? 'var(--accent-crimson)'
                          : 'var(--text-secondary)',
                  }}
                >
                  {copy.controlsSection.statusOptions[ctrl.status]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Mandatory Scope & Legal Disclaimer */}
        <footer
          data-testid="mandatory-legal-disclaimer"
          className="rounded-xl border p-4 text-xs leading-relaxed flex items-start gap-3 print-avoid-break"
          style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-elevated)' }}
        >
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--accent-amber)' }} />
          <div className="space-y-1">
            <div className="font-bold">{copy.reportSection.disclaimerTitle}</div>
            <p dir="auto">
              {locale === 'ar' ? AIDISCLOSE_LEGAL_DISCLAIMER_AR : AIDISCLOSE_LEGAL_DISCLAIMER_EN}
            </p>
          </div>
        </footer>
      </article>
    </div>
  );
}
