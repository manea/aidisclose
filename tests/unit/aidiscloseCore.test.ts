import { describe, expect, it } from 'vitest';

import {
  ART4_APPLICATION_DATE,
  ART50_APPLICATION_DATE,
  EU_AI_ACT_CODE,
  getAiActTimelineStatus,
  isValidAiSurface,
  isValidContactEmail,
  isValidMarkingStandard,
} from '../../src/core/aiActRules.ts';
import {
  AiDiscloseCoreError,
  auditAiInventoryCsv,
  auditAiTransparencyAndLiteracy,
  exportAiInventoryCsv,
  sanitizeCsvCell,
} from '../../src/core/disclosureAuditor.ts';
import {
  buildExecutiveSummaryText,
  computeDossierDigestHex,
  sealAiDiscloseDossier,
  verifyDossierIntegrity,
} from '../../src/core/dossierDigest.ts';
import {
  buildArticle4LiteracyRegisterMarkdown,
  buildArticle50NoticeHtmlSnippet,
  computeAiDiscloseSummary,
} from '../../src/core/noticeAndLiteracy.ts';
import { AIDISCLOSE_PRESETS, createDossierFromPreset } from '../../src/core/presets.ts';

describe('AIDisclose core EU AI Act (Regulation (EU) 2024/1689 Art. 4 & 50) engine', () => {
  it('validates enforcement timeline dates (2025-02-02 & 2026-08-02) and surface rules', () => {
    expect(ART4_APPLICATION_DATE).toBe('2025-02-02');
    expect(ART50_APPLICATION_DATE).toBe('2026-08-02');
    expect(isValidAiSurface('interactive_chatbot')).toBe(true);
    expect(isValidAiSurface('unknown_surface')).toBe(false);
    expect(isValidMarkingStandard('c2pa_provenance')).toBe(true);
    expect(isValidContactEmail('ai@company.eu')).toBe(true);
    expect(isValidContactEmail('not-an-email')).toBe(false);

    const mid2025 = getAiActTimelineStatus('2025-06-01T00:00:00.000Z');
    expect(mid2025.isArt4Enforced).toBe(true);
    expect(mid2025.isArt50Enforced).toBe(false);

    const late2026 = getAiActTimelineStatus('2026-11-24T00:00:00.000Z');
    expect(late2026.isArt4Enforced).toBe(true);
    expect(late2026.isArt50Enforced).toBe(true);
  });

  it('scores compliant SaaS AI Copilot preset 100/100 across disclosure, literacy, marking & overall', () => {
    expect(AIDISCLOSE_PRESETS).toHaveLength(3);
    const dossier = createDossierFromPreset('saas-copilot-compliant', '2026-11-24T00:00:00.000Z');
    expect(dossier.dossierNumber).toBe('AID-2026-0001');

    const audit = auditAiTransparencyAndLiteracy(
      dossier.organization,
      dossier.features,
      dossier.trainingRecords,
    );
    expect(audit.disclosureScore).toBe(100);
    expect(audit.literacyScore).toBe(100);
    expect(audit.machineReadableScore).toBe(100);
    expect(audit.literacyCompletionPct).toBe(100);
    expect(audit.errorsCount).toBe(0);
    expect(audit.warningsCount).toBe(0);

    const summary = computeAiDiscloseSummary(audit, dossier.controls, '2026-11-24T00:00:00.000Z');
    expect(summary.overallScore).toBe(100);
    expect(summary.controlsPassed).toBe(10);
    expect(summary.readinessTier).toBe('ready');
    expect(summary.blockingGapsCount).toBe(0);
  });

  it('detects Art. 50 deepfake, public-interest text, and Art. 4 low training gaps in newsroom preset', () => {
    const dossier = createDossierFromPreset('media-newsroom-gaps', '2026-11-24T00:00:00.000Z');
    const audit = auditAiTransparencyAndLiteracy(
      dossier.organization,
      dossier.features,
      dossier.trainingRecords,
    );

    const codes = audit.issues.map((i) => i.code);
    expect(codes).toContain('ART50_DEEPFAKE_DISCLOSURE_MISSING');
    expect(codes).toContain('ART50_PUBLIC_TEXT_DISCLOSURE_MISSING');
    expect(codes).toContain('ART4_LITERACY_COVERAGE_LOW');
    expect(codes).toContain('ART4_SHALLOW_CURRICULUM');
    expect(audit.literacyCompletionPct).toBe(42);
    expect(audit.errorsCount).toBeGreaterThanOrEqual(3);

    const summary = computeAiDiscloseSummary(audit, dossier.controls, '2026-11-24T00:00:00.000Z');
    expect(summary.readinessTier).toBe('blocked');
  });

  it('honors Art. 50(4) verified human editorial responsibility exemption on public-interest AI text', () => {
    const dossier = createDossierFromPreset('media-newsroom-gaps', '2026-11-24T00:00:00.000Z');
    const publicTextFeature = dossier.features[1];
    expect(publicTextFeature?.surface).toBe('public_interest_text');

    if (publicTextFeature) {
      publicTextFeature.humanEditorialResponsibilityVerified = true;
      publicTextFeature.editorialOwnerName = 'Marie Moreau';
    }

    const audit = auditAiTransparencyAndLiteracy(
      dossier.organization,
      dossier.features,
      dossier.trainingRecords,
    );
    expect(audit.editorialExemptionsUsed).toBe(1);
    expect(audit.issues.some((i) => i.code === 'ART50_PUBLIC_TEXT_DISCLOSURE_MISSING')).toBe(false);
  });

  it('bulk-audits AI inventory CSVs including editorial review exemptions & missing marking', () => {
    const csvInput = [
      'feature_id,feature_name,surface,disclosure_banner,machine_readable,wcag_accessible,editorial_review_owner',
      'BOT-01,Support Widget,interactive_chatbot,true,html_meta_tag,true,',
      'IMG-02,Promo Generator,synthetic_media_image_video_audio,false,none,false,',
      'NEWS-03,Civic Brief,public_interest_text,false,none,false,Claire Moreau',
    ].join('\n');

    const report = auditAiInventoryCsv(csvInput);
    expect(report.totalRows).toBe(3);
    expect(report.passedRows).toBe(2);
    expect(report.failedRows).toBe(1);
    expect(report.rows[0]?.status).toBe('pass');
    expect(report.rows[1]?.status).toBe('fail');
    expect(report.rows[2]?.editorialExemption).toBe(true);
    expect(report.rows[2]?.status).toBe('pass');
  });

  it('neutralizes CSV formula injection payloads and exports UTF-8 BOM CRLF inventory CSV', () => {
    expect(sanitizeCsvCell('=CMD()')).toBe('\'=CMD()');
    expect(sanitizeCsvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(sanitizeCsvCell('+SUM(A1:A2)')).toBe('\'+SUM(A1:A2)');
    expect(sanitizeCsvCell('-10')).toBe('\'-10');

    const report = auditAiInventoryCsv(
      [
        'feature_id,feature_name,surface,disclosure_banner,machine_readable,wcag_accessible,editorial_review_owner',
        '"=BAD-ID","AI Chat",interactive_chatbot,true,html_meta_tag,true,',
      ].join('\n'),
    );
    const csvEn = exportAiInventoryCsv(report, 'en');
    expect(csvEn.startsWith('\uFEFF')).toBe(true);
    expect(csvEn.includes('\r\n')).toBe(true);
    expect(csvEn.includes('\'=BAD-ID')).toBe(true);

    const csvAr = exportAiInventoryCsv(report, 'ar');
    expect(csvAr).toContain('الوسم_الآلي');
  });

  it('renders XSS-safe Art. 50 HTML + JSON-LD disclosure and Art. 4 register Markdown with disclaimer', () => {
    const dossier = createDossierFromPreset('hr-emotion-biometric-drill', '2026-11-24T00:00:00.000Z');
    const feat = dossier.features[0];
    if (feat) {
      feat.disclosureWordingEn = 'Notice </script><script>alert(1)</script> active.';
    }

    const html = buildArticle50NoticeHtmlSnippet(dossier, 'en');
    expect(html).toContain('role="note"');
    expect(html).toContain('application/ld+json');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;');

    const mdEn = buildArticle4LiteracyRegisterMarkdown(dossier, 'en');
    const mdAr = buildArticle4LiteracyRegisterMarkdown(dossier, 'ar');
    expect(mdEn).toContain(EU_AI_ACT_CODE);
    expect(mdEn).toContain('NOT legal counsel');
    expect(mdAr).toContain('ليست استشارة قانونية');
  });

  it('seals SHA-256 AID-YYYY-0001 snapshot, detects tampering, and throws typed AiDiscloseCoreError', async () => {
    const draft = createDossierFromPreset('saas-copilot-compliant', '2026-11-24T00:00:00.000Z');
    const hex = await computeDossierDigestHex(draft);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);

    const locked = await sealAiDiscloseDossier(draft, '2026-11-24T04:45:00.000Z');
    expect(locked.status).toBe('locked');
    expect((await verifyDossierIntegrity(locked)).valid).toBe(true);

    // Tampering training completed count breaks digest
    const tampered = {
      ...locked,
      trainingRecords: locked.trainingRecords.map((r, i) =>
        i === 0 ? { ...r, completedCount: 1 } : r,
      ),
    };
    expect((await verifyDossierIntegrity(tampered)).valid).toBe(false);

    const audit = auditAiTransparencyAndLiteracy(
      locked.organization,
      locked.features,
      locked.trainingRecords,
    );
    const summary = computeAiDiscloseSummary(audit, locked.controls, '2026-11-24T00:00:00.000Z');
    const execAr = buildExecutiveSummaryText(locked, audit, summary, 'ar');
    expect(execAr).toContain('AID-2026-0001');
    expect(execAr).toContain('100/100');

    expect(() => auditAiInventoryCsv('   ')).toThrowError(AiDiscloseCoreError);
    try {
      auditAiInventoryCsv('col1\nval1');
    } catch (err) {
      expect(err).toBeInstanceOf(AiDiscloseCoreError);
      expect((err as AiDiscloseCoreError).code).toBe('INVALID_CSV_HEADER');
    }
  });
});
