import {
  AIDISCLOSE_LEGAL_DISCLAIMER_AR,
  AIDISCLOSE_LEGAL_DISCLAIMER_EN,
  EU_AI_ACT_CODE,
  MARKING_STANDARD_LABELS,
  getAiActTimelineStatus,
} from './aiActRules.ts';
import type {
  AiDiscloseCheckItem,
  AiDiscloseDossier,
  AiDiscloseSummary,
  ControlStatus,
  Locale,
  TransparencyAuditReport,
} from './types.ts';

export interface AiControlSeedOverride {
  status: ControlStatus;
  evidenceNote?: string;
  owner?: string;
}

const DEFAULT_CONTROL_SPECS: ReadonlyArray<{
  id: string;
  articleRef: string;
  titleEn: string;
  titleAr: string;
  defaultOwner: string;
}> = [
  {
    id: 'ai-art4-staff-curriculum',
    articleRef: 'Art. 4',
    titleEn: 'Role-tailored AI literacy curriculum documented across operator teams',
    titleAr: 'توثيق منهج تدريب ومحو أمية الذكاء الاصطناعي حسب أدوار الفرق',
    defaultOwner: 'AI Governance / HR',
  },
  {
    id: 'ai-art4-oversight-pii',
    articleRef: 'Art. 4',
    titleEn: 'Human oversight, hallucination verification & PII prompt hygiene trained',
    titleAr: 'التدريب على الإشراف البشري وكشف الهلوسة وحماية البيانات الحساسة',
    defaultOwner: 'Engineering / Security',
  },
  {
    id: 'ai-art4-completion-log',
    articleRef: 'Art. 4',
    titleEn: 'Staff attendance & onboarding completion register kept current (>= 2025-02-02)',
    titleAr: 'حفظ سجل حضور وإتمام تدريب الموظفين والمنضمين الجدد (ساري منذ 2025-02-02)',
    defaultOwner: 'People Operations',
  },
  {
    id: 'ai-art50-1-chat-notice',
    articleRef: 'Art. 50(1)',
    titleEn: 'Interactive AI interfaces clearly notify users before or at first exchange',
    titleAr: 'إبلاغ المستخدم بوضوح في واجهات المحادثة عند أول تفاعل',
    defaultOwner: 'Product Design',
  },
  {
    id: 'ai-art50-2-machine-marking',
    articleRef: 'Art. 50(2)',
    titleEn: 'Synthetic outputs carry detectable machine-readable metadata (C2PA/IPTC/meta)',
    titleAr: 'وسم المخرجات التركيبية بصيغة مقروءة آلياً قابلة للاكتشاف',
    defaultOwner: 'ML Platform',
  },
  {
    id: 'ai-art50-3-biometric-emotion',
    articleRef: 'Art. 50(3)',
    titleEn: 'Exposed persons notified ahead of emotion recognition or biometric categorisation',
    titleAr: 'إخطار الأشخاص المعرّضين لأنظمة المشاعر أو التصنيف البيومتري مسبقاً',
    defaultOwner: 'DPO / Legal',
  },
  {
    id: 'ai-art50-4-deepfake-label',
    articleRef: 'Art. 50(4)',
    titleEn: 'Deepfake audio/image/video & synthetic media display prominent clear disclosure',
    titleAr: 'إبراز ملصق شفافية واضح لمحتوى التزييف العميق والوسائط التركيبية',
    defaultOwner: 'Content / Marketing',
  },
  {
    id: 'ai-art50-4-editorial-log',
    articleRef: 'Art. 50(4)',
    titleEn: 'Public-interest editorial exemption backed by named human editorial reviewer',
    titleAr: 'توثيق اسم المسؤول التحريري البشري عند الاستناد إلى استثناء المصلحة العامة',
    defaultOwner: 'Managing Editor',
  },
  {
    id: 'ai-art50-5-accessibility',
    articleRef: 'Art. 50(5)',
    titleEn: 'Transparency banners meet ARIA / WCAG 2.2 AA perceivable & timely standards',
    titleAr: 'توافق إشعارات الشفافية مع قارئات الشاشة وإمكانية الوصول WCAG 2.2 AA',
    defaultOwner: 'Frontend A11y',
  },
  {
    id: 'ai-gov-procurement-bundle',
    articleRef: 'Art. 4 & 50',
    titleEn: 'Vendor / customer due-diligence readiness package sealed with SHA-256 digest',
    titleAr: 'تجهيز حزمة جاهزية المشتريات ومراجعات العملاء موثّقة ببصمة SHA-256',
    defaultOwner: 'Compliance Lead',
  },
];

/** Builds the 10 standard EU AI Act Article 4 & 50 readiness controls. */
export function buildDefaultAiActControls(
  overrides: Partial<Record<string, ControlStatus | AiControlSeedOverride>> = {},
): AiDiscloseCheckItem[] {
  return DEFAULT_CONTROL_SPECS.map((spec) => {
    const raw = overrides[spec.id];
    let status: ControlStatus = 'not_started';
    let evidenceNote = '';
    let owner = spec.defaultOwner;

    if (typeof raw === 'string') {
      status = raw;
    } else if (raw) {
      status = raw.status;
      evidenceNote = raw.evidenceNote ?? '';
      owner = raw.owner ?? spec.defaultOwner;
    }

    return {
      id: spec.id,
      articleRef: spec.articleRef,
      titleEn: spec.titleEn,
      titleAr: spec.titleAr,
      status,
      evidenceNote,
      owner,
    };
  });
}

/** Computes aggregate readiness score and tier across audit metrics and the 10-control matrix. */
export function computeAiDiscloseSummary(
  audit: TransparencyAuditReport,
  controls: readonly AiDiscloseCheckItem[],
  referenceDateIso?: string,
): AiDiscloseSummary {
  const timeline = getAiActTimelineStatus(referenceDateIso);
  const totalControls = controls.length;
  const controlsPassed = controls.filter((c) => c.status === 'pass').length;
  const controlsFailed = controls.filter((c) => c.status === 'fail').length;
  const controlsInProgress = controls.filter((c) => c.status === 'in_progress').length;
  const controlsPending = totalControls - controlsPassed - controlsFailed;

  const controlsScore =
    totalControls === 0
      ? 0
      : ((controlsPassed + controlsInProgress * 0.45) / totalControls) * 100;

  const weighted =
    audit.disclosureScore * 0.35 +
    audit.literacyScore * 0.25 +
    audit.machineReadableScore * 0.15 +
    controlsScore * 0.25;

  const overallScore = Math.max(0, Math.min(100, Math.round(weighted)));
  const blockingGapsCount = audit.errorsCount + controlsFailed;

  let readinessTier: AiDiscloseSummary['readinessTier'];
  if (blockingGapsCount > 0) {
    readinessTier = overallScore >= 60 && blockingGapsCount <= 1 ? 'needs_remediation' : 'blocked';
  } else if (overallScore >= 85 && controlsPending === 0) {
    readinessTier = 'ready';
  } else {
    readinessTier = 'needs_remediation';
  }

  return {
    overallScore,
    controlsPassed,
    controlsFailed,
    controlsPending,
    totalControls,
    readinessTier,
    art4EffectiveSince: timeline.art4EffectiveSince,
    art50EffectiveSince: timeline.art50EffectiveSince,
    isArt4Enforced: timeline.isArt4Enforced,
    isArt50Enforced: timeline.isArt50Enforced,
    blockingGapsCount,
  };
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeJsonLdScript(jsonString: string): string {
  return jsonString.replaceAll('</script>', '<\\/script>').replaceAll('<', '\\u003c');
}

/**
 * Generates an XSS-safe, WCAG-annotated Article 50 HTML disclosure widget + JSON-LD provenance script
 * suitable for embedding in SaaS chat surfaces, landing pages, or synthetic media captions.
 */
export function buildArticle50NoticeHtmlSnippet(
  dossier: AiDiscloseDossier,
  locale: Locale = 'en',
): string {
  const { organization, features } = dossier;
  const itemsHtml = features
    .map((feat) => {
      const copy =
        locale === 'ar'
          ? feat.disclosureWordingAr.trim() || feat.disclosureWordingEn.trim()
          : feat.disclosureWordingEn.trim() || feat.disclosureWordingAr.trim();
      const exemptBadge =
        feat.surface === 'public_interest_text' &&
        feat.humanEditorialResponsibilityVerified &&
        Boolean((feat.editorialOwnerName || '').trim())
          ? ` [Editorial Review: ${feat.editorialOwnerName}]`
          : '';
      return `    <li data-surface="${escapeHtml(feat.surface)}" data-marking="${escapeHtml(feat.machineReadableMarking)}"><strong>${escapeHtml(feat.featureName)}</strong> (${escapeHtml(feat.modelName)}): ${escapeHtml(copy || 'DISCLOSURE COPY REQUIRED')}${escapeHtml(exemptBadge)}</li>`;
    })
    .join('\n');

  const jsonLdPayload = escapeJsonLdScript(
    JSON.stringify(
      {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: `${organization.legalName} — EU AI Act Article 50 Transparency Notice`,
        regulation: EU_AI_ACT_CODE,
        publisher: {
          '@type': 'Organization',
          name: organization.legalName,
          email: organization.contactEmail,
        },
        aiFeatures: features.map((f) => ({
          id: f.id,
          name: f.featureName,
          surface: f.surface,
          model: f.modelName,
          machineReadableMarking: f.machineReadableMarking,
        })),
      },
      null,
      2,
    ),
  );

  const heading =
    locale === 'ar'
      ? 'إفصاح الشفافية للذكاء الاصطناعي (لائحة الاتحاد الأوروبي 2024/1689 — المادة 50)'
      : 'AI Transparency Disclosure (Regulation (EU) 2024/1689 — Article 50)';

  return [
    `<aside class="eu-ai-act-disclosure" role="note" aria-label="${escapeHtml(heading)}" data-regulation="${escapeHtml(EU_AI_ACT_CODE)}">`,
    `  <strong>${escapeHtml(heading)}</strong>`,
    `  <ul>`,
    itemsHtml,
    `  </ul>`,
    `</aside>`,
    `<script type="application/ld+json">`,
    jsonLdPayload,
    `</script>`,
  ].join('\n');
}

/**
 * Generates an executive Markdown compliance dossier covering Article 4 staff AI literacy records,
 * Article 50 feature inventory & provenance marking, and the 10-control readiness matrix.
 */
export function buildArticle4LiteracyRegisterMarkdown(
  dossier: AiDiscloseDossier,
  locale: Locale = 'en',
): string {
  const { organization, features, trainingRecords, controls } = dossier;

  if (locale === 'ar') {
    const cohortRows =
      trainingRecords.length === 0
        ? '| — | لا توجد دفعات تدريب مسجلة | 0 | 0 | 0% | — |'
        : trainingRecords
            .map((r) => {
              const pct = r.staffCount > 0 ? Math.round((r.completedCount / r.staffCount) * 100) : 0;
              return `| ${r.id} | ${r.teamOrRole} | ${r.completedCount}/${r.staffCount} | ${pct}% | ${r.curriculumTopics.join('، ')} | ${r.lastSessionDateIso} |`;
            })
            .join('\n');

    const featureRows = features
      .map(
        (f) =>
          `| ${f.id} | ${f.featureName} | \`${f.surface}\` | ${f.disclosureBannerVisible ? 'نعم' : 'لا'} | ${MARKING_STANDARD_LABELS[f.machineReadableMarking].ar} | ${f.wcagAccessibleNotice ? 'نعم' : 'لا'} |`,
      )
      .join('\n');

    const controlRows = controls
      .map((c) => `| ${c.articleRef} | ${c.titleAr} | ${c.status} | ${c.evidenceNote || '—'} |`)
      .join('\n');

    return [
      `# سجل محو أمية الذكاء الاصطناعي والشفافية — ${EU_AI_ACT_CODE}`,
      '',
      `> **تنبيه قانوني إلزامي:** ${AIDISCLOSE_LEGAL_DISCLAIMER_AR}`,
      '',
      `- **رقم الملف:** \`${dossier.dossierNumber || 'DRAFT'}\` · **الحالة:** \`${dossier.status}\`${dossier.scopeDigestHex ? ` · **بصمة SHA-256:** \`${dossier.scopeDigestHex}\`` : ''}`,
      `- **المؤسسة:** ${organization.legalName} (${organization.countryCode}) · **الدور:** \`${organization.operatorRole}\` · **المسؤول:** ${organization.dpoOrGovLead} (\`${organization.contactEmail}\`)`,
      '',
      '## 1. سجل تدريب الموظفين — المادة 4 (سارية منذ 2025-02-02)',
      '| المعرف | الفريق / الدور | الإتمام | النسبة | محاور التدريب | آخر جلسة |',
      '| --- | --- | --- | --- | --- | --- |',
      cohortRows,
      '',
      '## 2. جرد شفافية ميزات الذكاء الاصطناعي — المادة 50 (سارية منذ 2026-08-02)',
      '| المعرف | الميزة | السطح | إشعار ظاهر | الوسم الآلي | WCAG |',
      '| --- | --- | --- | --- | --- | --- |',
      featureRows,
      '',
      '## 3. قائمة الضوابط العشرة للمادتين 4 و50',
      '| المادة | الضابط | الحالة | الدليل |',
      '| --- | --- | --- | --- |',
      controlRows,
    ].join('\n');
  }

  const cohortRows =
    trainingRecords.length === 0
      ? '| — | No training cohorts logged | 0/0 | 0% | — | — |'
      : trainingRecords
          .map((r) => {
            const pct = r.staffCount > 0 ? Math.round((r.completedCount / r.staffCount) * 100) : 0;
            return `| ${r.id} | ${r.teamOrRole} | ${r.completedCount}/${r.staffCount} | ${pct}% | ${r.curriculumTopics.join(', ')} | ${r.lastSessionDateIso} |`;
          })
          .join('\n');

  const featureRows = features
    .map(
      (f) =>
        `| ${f.id} | ${f.featureName} | \`${f.surface}\` | ${f.disclosureBannerVisible ? 'Yes' : 'No'} | ${MARKING_STANDARD_LABELS[f.machineReadableMarking].en} | ${f.wcagAccessibleNotice ? 'Yes' : 'No'} |`,
    )
    .join('\n');

  const controlRows = controls
    .map((c) => `| ${c.articleRef} | ${c.titleEn} | ${c.status} | ${c.evidenceNote || '—'} |`)
    .join('\n');

  return [
    `# EU AI Act Article 4 AI Literacy & Article 50 Transparency Dossier — ${EU_AI_ACT_CODE}`,
    '',
    `> **Mandatory Disclaimer:** ${AIDISCLOSE_LEGAL_DISCLAIMER_EN}`,
    '',
    `- **Dossier Reference:** \`${dossier.dossierNumber || 'DRAFT'}\` · **Status:** \`${dossier.status}\`${dossier.scopeDigestHex ? ` · **SHA-256 Digest:** \`${dossier.scopeDigestHex}\`` : ''}`,
    `- **Organization:** ${organization.legalName} (${organization.countryCode}) · **Operator Role:** \`${organization.operatorRole}\` · **Governance Lead:** ${organization.dpoOrGovLead} (\`${organization.contactEmail}\`)`,
    '',
    '## 1. Article 4 AI Literacy Register (Applicable since 2025-02-02)',
    '| ID | Team / Role | Completed | Coverage | Curriculum Topics | Last Session |',
    '| --- | --- | --- | --- | --- | --- |',
    cohortRows,
    '',
    '## 2. Article 50 AI Surface Transparency Inventory (Applicable since 2026-08-02)',
    '| ID | Feature | Surface | Visible Notice | Machine-Readable Marking | WCAG |',
    '| --- | --- | --- | --- | --- | --- |',
    featureRows,
    '',
    '## 3. 10-Control Readiness Verification Matrix',
    '| Article | Control Requirement | Status | Evidence Note |',
    '| --- | --- | --- | --- |',
    controlRows,
  ].join('\n');
}
