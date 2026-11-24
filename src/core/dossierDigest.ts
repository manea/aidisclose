import { EU_AI_ACT_CODE } from './aiActRules.ts';
import type {
  AiDiscloseDossier,
  AiDiscloseSummary,
  Locale,
  TransparencyAuditReport,
} from './types.ts';

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Produces deterministic canonical JSON over the compliance-critical scope
 * (excluding mutable timestamps like updatedAt/lockedAt) for verifiable SHA-256 sealing.
 */
export function buildDossierCanonicalText(dossier: AiDiscloseDossier): string {
  const canonical = {
    regulation: EU_AI_ACT_CODE,
    id: dossier.id,
    dossierNumber: dossier.dossierNumber,
    organization: {
      legalName: dossier.organization.legalName.trim(),
      contactEmail: dossier.organization.contactEmail.trim().toLowerCase(),
      countryCode: dossier.organization.countryCode.trim().toUpperCase(),
      operatorRole: dossier.organization.operatorRole,
      dpoOrGovLead: dossier.organization.dpoOrGovLead.trim(),
    },
    features: [...dossier.features]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((f) => ({
        id: f.id,
        featureName: f.featureName.trim(),
        surface: f.surface,
        providerName: f.providerName.trim(),
        modelName: f.modelName.trim(),
        disclosureBannerVisible: f.disclosureBannerVisible,
        disclosureWordingEn: f.disclosureWordingEn.trim(),
        disclosureWordingAr: f.disclosureWordingAr.trim(),
        machineReadableMarking: f.machineReadableMarking,
        wcagAccessibleNotice: f.wcagAccessibleNotice,
        interactiveObviousException: f.interactiveObviousException,
        humanEditorialResponsibilityVerified: f.humanEditorialResponsibilityVerified,
        editorialOwnerName: (f.editorialOwnerName || '').trim(),
      })),
    trainingRecords: [...dossier.trainingRecords]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((t) => ({
        id: t.id,
        teamOrRole: t.teamOrRole.trim(),
        staffCount: t.staffCount,
        completedCount: t.completedCount,
        curriculumTopics: [...t.curriculumTopics].sort(),
        lastSessionDateIso: t.lastSessionDateIso.trim(),
      })),
    controls: [...dossier.controls]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((c) => ({
        id: c.id,
        articleRef: c.articleRef,
        status: c.status,
        evidenceNote: c.evidenceNote.trim(),
      })),
  };

  return JSON.stringify(canonical);
}

/** Computes a SHA-256 hex digest using Web Crypto over the canonical dossier scope. */
export async function computeDossierDigestHex(dossier: AiDiscloseDossier): Promise<string> {
  const payload = new TextEncoder().encode(buildDossierCanonicalText(dossier));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', payload);
  return toHex(digest);
}

/** Seals an AIDisclose dossier as `locked` with a cryptographic SHA-256 fingerprint. */
export async function sealAiDiscloseDossier(
  dossier: AiDiscloseDossier,
  lockedAtIso: string = new Date().toISOString(),
): Promise<AiDiscloseDossier> {
  const digestHex = await computeDossierDigestHex(dossier);
  return {
    ...dossier,
    status: 'locked',
    lockedAt: lockedAtIso,
    updatedAt: lockedAtIso,
    scopeDigestHex: digestHex,
  };
}

export interface DossierIntegrityResult {
  valid: boolean;
  expectedDigestHex: string;
  actualDigestHex: string;
}

/** Verifies that a locked dossier's stored SHA-256 matches its recomputed canonical text. */
export async function verifyDossierIntegrity(
  dossier: AiDiscloseDossier,
): Promise<DossierIntegrityResult> {
  const actualDigestHex = await computeDossierDigestHex(dossier);
  const expectedDigestHex = dossier.scopeDigestHex;
  const valid =
    dossier.status === 'locked' &&
    expectedDigestHex.length === 64 &&
    expectedDigestHex === actualDigestHex;
  return {
    valid,
    expectedDigestHex,
    actualDigestHex,
  };
}

/** Builds a concise bilingual governance readiness summary paragraph. */
export function buildExecutiveSummaryText(
  dossier: AiDiscloseDossier,
  audit: TransparencyAuditReport,
  summary: AiDiscloseSummary,
  locale: Locale = 'en',
): string {
  if (locale === 'ar') {
    return [
      `ملخص جاهزية الشفافية (${EU_AI_ACT_CODE}) — ${dossier.dossierNumber || 'DRAFT'}`,
      `المؤسسة: ${dossier.organization.legalName} | الأنظمة المسجلة: ${dossier.features.length} | إتمام تدريب المادة 4: ${audit.literacyCompletionPct}%`,
      `النتيجة الكلية: ${summary.overallScore}/100 (${summary.readinessTier}) | الإفصاح (المادة 50): ${audit.disclosureScore}/100 | الوسم الآلي: ${audit.machineReadableScore}/100`,
      `الفجوات الحرجة: ${summary.blockingGapsCount} | استثناءات التحرير البشري: ${audit.editorialExemptionsUsed}`,
    ].join('\n');
  }

  return [
    `EU AI Act Readiness Brief (${EU_AI_ACT_CODE}) — ${dossier.dossierNumber || 'DRAFT'}`,
    `Organization: ${dossier.organization.legalName} | AI Surfaces: ${dossier.features.length} | Art. 4 Literacy: ${audit.literacyCompletionPct}%`,
    `Overall Score: ${summary.overallScore}/100 (${summary.readinessTier}) | Disclosure (Art. 50): ${audit.disclosureScore}/100 | Machine Marking: ${audit.machineReadableScore}/100`,
    `Blocking Gaps: ${summary.blockingGapsCount} | Editorial Review Exemptions: ${audit.editorialExemptionsUsed}`,
  ].join('\n');
}
