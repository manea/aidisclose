import {
  isValidAiSurface,
  isValidContactEmail,
  isValidMarkingStandard,
} from './aiActRules.ts';
import type {
  AiFeatureInventoryItem,
  AiLiteracyTrainingRecord,
  InventoryCsvAuditReport,
  InventoryCsvRowResult,
  Locale,
  MarkingStandard,
  OrganizationAiProfile,
  TransparencyAuditReport,
  TransparencyIssue,
} from './types.ts';

export type AiDiscloseCoreErrorCode =
  | 'EMPTY_CSV'
  | 'INVALID_CSV_HEADER'
  | 'INVALID_CATALOG'
  | 'MISSING_INPUT';

/** Typed domain error thrown on malformed AI inventory CSVs or governance inputs. */
export class AiDiscloseCoreError extends Error {
  readonly code: AiDiscloseCoreErrorCode;

  constructor(code: AiDiscloseCoreErrorCode, message: string) {
    super(message);
    this.name = 'AiDiscloseCoreError';
    this.code = code;
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function makeIssue(
  code: string,
  articleRef: string,
  severity: TransparencyIssue['severity'],
  messageEn: string,
  messageAr: string,
  featureId?: string,
): TransparencyIssue {
  return {
    code,
    articleRef,
    ...(featureId ? { featureId } : {}),
    severity,
    messageEn,
    messageAr,
  };
}

/**
 * Evaluates EU AI Act Article 4 AI Literacy staff coverage and Article 50 Transparency
 * disclosures across all registered AI systems & user-facing features.
 */
export function auditAiTransparencyAndLiteracy(
  org: OrganizationAiProfile,
  features: readonly AiFeatureInventoryItem[],
  trainingRecords: readonly AiLiteracyTrainingRecord[],
): TransparencyAuditReport {
  const issues: TransparencyIssue[] = [];

  if (!org.legalName.trim() || !isValidContactEmail(org.contactEmail) || !org.dpoOrGovLead.trim()) {
    issues.push(
      makeIssue(
        'ORG_GOVERNANCE_INCOMPLETE',
        'Art. 4 & Governance',
        'error',
        'Organization legal name, valid compliance email, and accountable AI governance lead are required.',
        'يلزم توثيق الاسم القانوني للمؤسسة وبريد الامتثال الصالح واسم مسؤول حوكمة الذكاء الاصطناعي.',
      ),
    );
  }

  let featureDisclosureSum = 0;
  let markingEligibleCount = 0;
  let markingPassedCount = 0;
  let editorialExemptionsUsed = 0;

  if (features.length === 0) {
    issues.push(
      makeIssue(
        'NO_AI_FEATURES_INVENTORIED',
        'Art. 50 Scope',
        'error',
        'Register at least one AI interaction surface or generative/synthetic output feature.',
        'يجب تسجيل نظام أو ميزة ذكاء اصطناعي واحدة على الأقل لتقييم شفافية المادة 50.',
      ),
    );
  } else {
    for (const feat of features) {
      let featurePts = 0;
      const hasWording =
        Boolean(feat.disclosureWordingEn.trim()) || Boolean(feat.disclosureWordingAr.trim());

      if (feat.surface === 'interactive_chatbot') {
        const bannerSatisfied = feat.disclosureBannerVisible || feat.interactiveObviousException;
        if (!bannerSatisfied) {
          issues.push(
            makeIssue(
              'ART50_CHATBOT_DISCLOSURE_MISSING',
              'Art. 50(1)',
              'error',
              `Chatbot feature "${feat.featureName}" must inform users they are interacting with AI.`,
              `ميزة المحادثة «${feat.featureName}» تتطلب إعلام المستخدمين بوضوح بأنهم يتفاعلون مع ذكاء اصطناعي.`,
              feat.id,
            ),
          );
        } else {
          featurePts += 50;
        }
        if (hasWording) {
          featurePts += 25;
        } else if (!feat.interactiveObviousException) {
          issues.push(
            makeIssue(
              'ART50_DISCLOSURE_WORDING_EMPTY',
              'Art. 50(1) & 50(5)',
              'warning',
              `Provide explicit English or Arabic disclosure notice copy for "${feat.featureName}".`,
              `يرجى توثيق نص الإفصاح الظاهر للمستخدم للميزة «${feat.featureName}».`,
              feat.id,
            ),
          );
        } else {
          featurePts += 25;
        }
        if (feat.wcagAccessibleNotice) {
          featurePts += 25;
        } else {
          issues.push(
            makeIssue(
              'ART50_ACCESSIBILITY_GAP',
              'Art. 50(5)',
              'warning',
              `Disclosure for "${feat.featureName}" is not marked WCAG 2.2 AA / screen-reader accessible.`,
              `إفصاح «${feat.featureName}» غير مضبوط كمتوافق مع قارئات الشاشة وإمكانية الوصول WCAG 2.2 AA.`,
              feat.id,
            ),
          );
        }
      } else if (feat.surface === 'synthetic_media_image_video_audio') {
        markingEligibleCount += 1;
        if (feat.machineReadableMarking !== 'none') {
          markingPassedCount += 1;
          featurePts += 60;
        } else if (org.operatorRole === 'provider' || org.operatorRole === 'both') {
          issues.push(
            makeIssue(
              'ART50_MACHINE_MARKING_MISSING',
              'Art. 50(2)',
              'error',
              `Synthetic media provider output "${feat.featureName}" lacks machine-readable provenance marking (C2PA / IPTC / HTML meta / audio watermark).`,
              `مخرجات الوسائط التركيبية «${feat.featureName}» تفتقد الوسم المقروء آلياً للمادة 50(2).`,
              feat.id,
            ),
          );
        } else {
          featurePts += 40;
          issues.push(
            makeIssue(
              'ART50_DEPLOYER_PROVENANCE_CHECK',
              'Art. 50(2)',
              'warning',
              `Verify upstream model provider supplies Art. 50(2) machine-readable marking for "${feat.featureName}".`,
              `تحقق من وجود وسم المصدر المقروء آلياً من مزود النموذج الأساسي للميزة «${feat.featureName}».`,
              feat.id,
            ),
          );
        }
        if (feat.disclosureBannerVisible && hasWording && feat.wcagAccessibleNotice) {
          featurePts += 40;
        } else if (!feat.disclosureBannerVisible) {
          issues.push(
            makeIssue(
              'ART50_SYNTHETIC_LABEL_MISSING',
              'Art. 50(2) & 50(5)',
              'warning',
              `Add visible consumer label alongside machine-readable metadata for "${feat.featureName}".`,
              `يُوصى بإظهار وسم مرئي للمستخدم بجانب الوسم البرمجي للميزة «${feat.featureName}».`,
              feat.id,
            ),
          );
        } else {
          featurePts += 20;
        }
      } else if (feat.surface === 'deepfake_media') {
        markingEligibleCount += 1;
        if (feat.machineReadableMarking !== 'none') {
          markingPassedCount += 1;
          featurePts += 25;
        } else {
          issues.push(
            makeIssue(
              'ART50_DEEPFAKE_MARKING_ABSENT',
              'Art. 50(2) & 50(4)',
              'warning',
              `Attach C2PA/IPTC provenance metadata alongside visible deepfake label on "${feat.featureName}".`,
              `أضف بيانات المصدر المقروءة آلياً بجانب الوسم الظاهر لمحتوى «${feat.featureName}».`,
              feat.id,
            ),
          );
        }
        if (feat.disclosureBannerVisible && hasWording) {
          featurePts += 50;
        } else {
          issues.push(
            makeIssue(
              'ART50_DEEPFAKE_DISCLOSURE_MISSING',
              'Art. 50(4)',
              'error',
              `Deepfake deployment "${feat.featureName}" MUST visibly disclose artificial generation or manipulation.`,
              `إفصاح المحتوى المركّب / التزييف العميق «${feat.featureName}» إلزامي بوضوح بموجب المادة 50(4).`,
              feat.id,
            ),
          );
        }
        if (feat.wcagAccessibleNotice) {
          featurePts += 25;
        } else {
          issues.push(
            makeIssue(
              'ART50_ACCESSIBILITY_GAP',
              'Art. 50(5)',
              'warning',
              `Make deepfake disclosure accessible for screen readers on "${feat.featureName}".`,
              `تأكد من توافق وسم التزييف العميق في «${feat.featureName}» مع قارئات الشاشة WCAG.`,
              feat.id,
            ),
          );
        }
      } else if (feat.surface === 'public_interest_text') {
        const editorialExempt =
          feat.humanEditorialResponsibilityVerified && Boolean((feat.editorialOwnerName || '').trim());
        if (editorialExempt) {
          editorialExemptionsUsed += 1;
          featurePts = 100;
        } else {
          if (feat.disclosureBannerVisible && hasWording) {
            featurePts += 75;
          } else {
            issues.push(
              makeIssue(
                'ART50_PUBLIC_TEXT_DISCLOSURE_MISSING',
                'Art. 50(4)',
                'error',
                `Public-interest AI text "${feat.featureName}" lacks visible AI generation label AND lacks verified human editorial responsibility exemption.`,
                `النص العام المولّد بالذكاء الاصطناعي «${feat.featureName}» يفتقد لإشعار الإفصاح كما لا توجد مراجعة وتحرير بشري مسؤول موثق.`,
                feat.id,
              ),
            );
          }
          if (feat.wcagAccessibleNotice) {
            featurePts += 25;
          }
        }
      } else {
        // emotion_biometric (Art. 50(3))
        if (feat.disclosureBannerVisible && hasWording) {
          featurePts += 75;
        } else {
          issues.push(
            makeIssue(
              'ART50_BIOMETRIC_EMOTION_NOTICE_MISSING',
              'Art. 50(3)',
              'error',
              `Emotion recognition / biometric categorisation system "${feat.featureName}" must notify exposed natural persons in advance.`,
              `نظام التعرّف على المشاعر أو التصنيف البيومتري «${feat.featureName}» يلزم فيه إشعار الأشخاص الطبيعيين مسبقاً (المادة 50-3).`,
              feat.id,
            ),
          );
        }
        if (feat.wcagAccessibleNotice) {
          featurePts += 25;
        } else {
          issues.push(
            makeIssue(
              'ART50_ACCESSIBILITY_GAP',
              'Art. 50(5)',
              'warning',
              `Ensure prior biometric/emotion notice on "${feat.featureName}" satisfies Art. 50(5) accessibility.`,
              `تأكد من إتاحة إشعار التصنيف البيومتري في «${feat.featureName}» وفق متطلبات إمكانية الوصول.`,
              feat.id,
            ),
          );
        }
      }

      featureDisclosureSum += featurePts;
    }
  }

  // Article 4 AI Literacy Training Audit
  let totalStaff = 0;
  let totalCompleted = 0;
  let shallowCohorts = 0;

  if (trainingRecords.length === 0) {
    issues.push(
      makeIssue(
        'ART4_NO_TRAINING_RECORDS',
        'Art. 4',
        'error',
        'No Article 4 AI literacy training cohorts documented (obligation active since 2025-02-02).',
        'لا توجد سجلات لتدريب الموظفين ومحو أمية الذكاء الاصطناعي للمادة 4 (سارية منذ 2025-02-02).',
      ),
    );
  } else {
    for (const rec of trainingRecords) {
      const staff = Math.max(0, Math.floor(rec.staffCount));
      const completed = Math.min(staff, Math.max(0, Math.floor(rec.completedCount)));
      totalStaff += staff;
      totalCompleted += completed;
      if (rec.curriculumTopics.length < 2) {
        shallowCohorts += 1;
      }
    }

    if (shallowCohorts > 0) {
      issues.push(
        makeIssue(
          'ART4_SHALLOW_CURRICULUM',
          'Art. 4',
          'warning',
          `${shallowCohorts} cohort(s) list fewer than 2 AI literacy curriculum topics (risks/limitations, prompt/PII hygiene, human oversight).`,
          `يوجد ${shallowCohorts} مجموعة تدريب تقل مواضيعها عن موضوعين في المنهج (حدود الهلوسة، خصوصية البيانات، والإشراف البشري).`,
        ),
      );
    }
  }

  const literacyCompletionPct =
    totalStaff === 0 ? 0 : Math.min(100, Math.round((totalCompleted / totalStaff) * 100));

  if (trainingRecords.length > 0 && literacyCompletionPct < 80) {
    issues.push(
      makeIssue(
        'ART4_LITERACY_COVERAGE_LOW',
        'Art. 4',
        'error',
        `Staff AI literacy completion is ${literacyCompletionPct}%; raise cohort completion >= 80% (target 100%).`,
        `نسبة إتمام تدريب المادة 4 للموظفين هي ${literacyCompletionPct}% فقط؛ يلزم رفع التغطية إلى 80% فأعلى (والمستهدف 100%).`,
      ),
    );
  } else if (trainingRecords.length > 0 && literacyCompletionPct < 100) {
    issues.push(
      makeIssue(
        'ART4_LITERACY_PARTIAL',
        'Art. 4',
        'warning',
        `Staff AI literacy is at ${literacyCompletionPct}%; finalize remaining onboarding completions for 100% Article 4 readiness.`,
        `إتمام تدريب المادة 4 عند ${literacyCompletionPct}%؛ يُنصح باستكمال الموظفين المتبقين للوصول إلى جاهزية 100%.`,
      ),
    );
  }

  const disclosureScore =
    features.length === 0 ? 0 : clampScore(featureDisclosureSum / features.length);
  const machineReadableScore =
    markingEligibleCount === 0
      ? features.length === 0
        ? 0
        : 100
      : clampScore((markingPassedCount / markingEligibleCount) * 100);
  const orgPenalty = org.legalName.trim() && isValidContactEmail(org.contactEmail) ? 0 : 20;
  const curriculumPenalty = shallowCohorts > 0 ? 10 : 0;
  const literacyScore =
    trainingRecords.length === 0
      ? 0
      : clampScore(literacyCompletionPct - orgPenalty - curriculumPenalty);

  const errorsCount = issues.filter((it) => it.severity === 'error').length;
  const warningsCount = issues.filter((it) => it.severity === 'warning').length;

  return {
    disclosureScore,
    literacyScore,
    machineReadableScore,
    literacyCompletionPct,
    editorialExemptionsUsed,
    errorsCount,
    warningsCount,
    issues,
  };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseBooleanCell(raw: string): boolean {
  const cleaned = raw.trim().toLowerCase();
  return cleaned === 'true' || cleaned === 'yes' || cleaned === '1';
}

/**
 * Bulk-audits an AI feature/product inventory CSV against Article 50 disclosure,
 * machine-readable marking, and WCAG accessibility requirements.
 */
export function auditAiInventoryCsv(csvText: string): InventoryCsvAuditReport {
  const normalized = csvText.replace(/^\uFEFF/, '').trim();
  if (!normalized) {
    throw new AiDiscloseCoreError('EMPTY_CSV', 'AI feature inventory CSV input is empty.');
  }

  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new AiDiscloseCoreError(
      'INVALID_CSV_HEADER',
      'CSV must contain a header row and at least one feature row.',
    );
  }

  const headerLine = lines[0];
  if (!headerLine) {
    throw new AiDiscloseCoreError('INVALID_CSV_HEADER', 'Missing CSV header row.');
  }

  const headers = parseCsvLine(headerLine).map((col) => col.toLowerCase());
  const idx = (name: string): number => headers.indexOf(name);

  const idIdx = idx('feature_id');
  const nameIdx = idx('feature_name');
  const surfaceIdx = idx('surface');
  if (nameIdx === -1 || surfaceIdx === -1) {
    throw new AiDiscloseCoreError(
      'INVALID_CSV_HEADER',
      'CSV header must include required columns: feature_name, surface.',
    );
  }

  const bannerIdx = idx('disclosure_banner');
  const markingIdx = idx('machine_readable');
  const wcagIdx = idx('wcag_accessible');
  const editorialOwnerIdx = idx('editorial_review_owner');

  const cell = (rowCells: string[], colIdx: number): string =>
    colIdx >= 0 && colIdx < rowCells.length ? (rowCells[colIdx] ?? '') : '';

  const rows: InventoryCsvRowResult[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const rawLine = lines[i];
    if (!rawLine) continue;
    const cells = parseCsvLine(rawLine);

    const featureId = cell(cells, idIdx) || `AI-${i}`;
    const featureName = cell(cells, nameIdx) || `Feature ${i}`;
    const rawSurface = cell(cells, surfaceIdx);
    const disclosureBanner = parseBooleanCell(cell(cells, bannerIdx));
    const rawMarking = cell(cells, markingIdx).toLowerCase();
    const machineReadable: MarkingStandard = isValidMarkingStandard(rawMarking)
      ? rawMarking
      : 'none';
    const wcagAccessible = parseBooleanCell(cell(cells, wcagIdx));
    const editorialOwner = cell(cells, editorialOwnerIdx);
    const editorialExemption =
      rawSurface === 'public_interest_text' && Boolean(editorialOwner.trim());

    const rowIssues: TransparencyIssue[] = [];
    if (!isValidAiSurface(rawSurface)) {
      rowIssues.push(
        makeIssue(
          'CSV_INVALID_SURFACE',
          'Art. 50 Scope',
          'error',
          `Unknown AI surface "${rawSurface}".`,
          `نوع السطح «${rawSurface}» غير صالح.`,
          featureId,
        ),
      );
    } else if (!editorialExemption) {
      if (!disclosureBanner) {
        rowIssues.push(
          makeIssue(
            'CSV_DISCLOSURE_MISSING',
            'Art. 50',
            'error',
            `Feature "${featureName}" lacks visible AI disclosure notice.`,
            `الميزة «${featureName}» تفتقد لإشعار الإفصاح المرئي.`,
            featureId,
          ),
        );
      }
      if (
        (rawSurface === 'synthetic_media_image_video_audio' || rawSurface === 'deepfake_media') &&
        machineReadable === 'none'
      ) {
        rowIssues.push(
          makeIssue(
            'CSV_MARKING_MISSING',
            'Art. 50(2)',
            'error',
            `Synthetic/deepfake media "${featureName}" missing machine-readable provenance marking.`,
            `الميزة «${featureName}» تفتقد للوسم المقروء آلياً (C2PA/IPTC/meta).`,
            featureId,
          ),
        );
      }
      if (!wcagAccessible) {
        rowIssues.push(
          makeIssue(
            'CSV_WCAG_WARNING',
            'Art. 50(5)',
            'warning',
            `Verify WCAG 2.2 AA accessible contrast and ARIA labeling for "${featureName}".`,
            `تأكد من توافق إشعار «${featureName}» مع إمكانية الوصول WCAG.`,
            featureId,
          ),
        );
      }
    }

    let score = 0;
    if (isValidAiSurface(rawSurface)) {
      if (editorialExemption) {
        score = 100;
      } else {
        if (disclosureBanner) score += 50;
        if (wcagAccessible) score += 20;
        const needsMarking =
          rawSurface === 'synthetic_media_image_video_audio' || rawSurface === 'deepfake_media';
        if (!needsMarking || machineReadable !== 'none') score += 30;
      }
    }

    const rowStatus: 'pass' | 'fail' = rowIssues.some((it) => it.severity === 'error')
      ? 'fail'
      : 'pass';

    rows.push({
      rowNumber: i + 1,
      featureId,
      featureName,
      surface: rawSurface || 'unknown',
      disclosureBanner,
      machineReadable,
      wcagAccessible,
      editorialExemption,
      status: rowStatus,
      score: clampScore(score),
      issues: rowIssues,
    });
  }

  const totalRows = rows.length;
  const passedRows = rows.filter((r) => r.status === 'pass').length;
  const failedRows = totalRows - passedRows;
  const averageScore =
    totalRows === 0 ? 0 : Math.round(rows.reduce((acc, r) => acc + r.score, 0) / totalRows);

  return {
    totalRows,
    passedRows,
    failedRows,
    averageScore,
    rows,
  };
}

/**
 * Escapes CSV values for RFC 4180 compliance and neutralizes spreadsheet formula injection
 * (`=`, `+`, `-`, `@`, `\t`, `\r` prefixed with `'`).
 */
export function sanitizeCsvCell(value: string | number | boolean): string {
  const str = String(value);
  const formulaSafe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(formulaSafe)) {
    return `"${formulaSafe.replaceAll('"', '""')}"`;
  }
  return formulaSafe;
}

/** Exports audited AI inventory rows as UTF-8 BOM CRLF CSV. */
export function exportAiInventoryCsv(
  report: InventoryCsvAuditReport,
  locale: Locale = 'en',
): string {
  if (!report || !Array.isArray(report.rows)) {
    throw new AiDiscloseCoreError('INVALID_CATALOG', 'Inventory report must contain a rows array.');
  }

  const headers =
    locale === 'ar'
      ? [
          'المعرف',
          'الميزة',
          'السطح_التنظيمي',
          'إشعار_ظاهر',
          'الوسم_الآلي',
          'توافق_WCAG',
          'استثناء_تحريري',
          'الحالة',
          'الدرجة',
        ]
      : [
          'feature_id',
          'feature_name',
          'surface',
          'disclosure_banner',
          'machine_readable',
          'wcag_accessible',
          'editorial_exemption',
          'status',
          'score',
        ];

  const lines: string[] = [headers.map((h) => sanitizeCsvCell(h)).join(',')];
  for (const row of report.rows) {
    lines.push(
      [
        row.featureId,
        row.featureName,
        row.surface,
        row.disclosureBanner,
        row.machineReadable,
        row.wcagAccessible,
        row.editorialExemption,
        row.status,
        row.score,
      ]
        .map((c) => sanitizeCsvCell(c))
        .join(','),
    );
  }

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
