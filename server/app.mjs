import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidAiSurface, isValidMarkingStandard } from '../src/core/aiActRules.ts';
import {
  AiDiscloseCoreError,
  auditAiInventoryCsv,
  auditAiTransparencyAndLiteracy,
  exportAiInventoryCsv,
} from '../src/core/disclosureAuditor.ts';
import {
  buildArticle4LiteracyRegisterMarkdown,
  buildArticle50NoticeHtmlSnippet,
  buildDefaultAiActControls,
  computeAiDiscloseSummary,
} from '../src/core/noticeAndLiteracy.ts';
import {
  buildDossierCanonicalText,
  buildExecutiveSummaryText,
} from '../src/core/dossierDigest.ts';
import { AIDISCLOSE_PRESETS, createDossierFromPreset } from '../src/core/presets.ts';
import { openAiDiscloseDatabase, slugify } from './db.mjs';

const __serverDir = path.dirname(fileURLToPath(import.meta.url));
let APP_VERSION = '0.2.0';
try {
  const pkgJson = JSON.parse(
    fs.readFileSync(path.resolve(__serverDir, '../package.json'), 'utf8'),
  );
  if (typeof pkgJson.version === 'string' && pkgJson.version.trim()) {
    APP_VERSION = pkgJson.version.trim();
  }
} catch {
  // fallback version
}

const MAX_JSON_BODY = 5 * 1024 * 1024; // 5 MB limit
const VALID_OPERATOR_ROLES = new Set(['provider', 'deployer', 'both']);
const VALID_CONTROL_STATUSES = new Set(['pass', 'fail', 'in_progress', 'not_started']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_JSON_BODY) {
      const err = new Error('JSON payload exceeds 5 MB limit');
      err.statusCode = 413;
      err.code = 'PAYLOAD_TOO_LARGE';
      throw err;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error('Invalid JSON payload');
    err.statusCode = 400;
    err.code = 'INVALID_JSON';
    throw err;
  }
}

function normalizeBasePath(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let trimmed = raw.trim();
  if (!trimmed || trimmed === '/') return '';
  if (!trimmed.startsWith('/')) trimmed = `/${trimmed}`;
  return trimmed.replace(/\/+$/, '');
}

function resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath = '') {
  if (normalizedAppOrigin) return normalizedAppOrigin;
  const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const proto = protoHeader || (req.socket?.encrypted ? 'https' : 'http');
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '127.0.0.1:4197')
    .split(',')[0]
    .trim();
  return `${proto}://${hostHeader}${normalizedBasePath}`;
}

function mergeOrganizationProfile(patch, fallback) {
  const fb = fallback || {
    legalName: 'EU AI Operator B.V.',
    contactEmail: 'ai-governance@operator-example.eu',
    countryCode: 'NL',
    operatorRole: 'deployer',
    dpoOrGovLead: 'AI Governance Lead',
  };
  const src = patch && typeof patch === 'object' ? patch : {};
  const rawRole = String(src.operatorRole ?? fb.operatorRole).trim().toLowerCase();

  return {
    legalName: String(src.legalName ?? fb.legalName).trim(),
    contactEmail: String(src.contactEmail ?? fb.contactEmail).trim(),
    countryCode: String(src.countryCode ?? fb.countryCode).trim().toUpperCase(),
    operatorRole: VALID_OPERATOR_ROLES.has(rawRole) ? rawRole : fb.operatorRole,
    dpoOrGovLead: String(src.dpoOrGovLead ?? fb.dpoOrGovLead).trim(),
    ...(src.governancePolicyUrl !== undefined
      ? { governancePolicyUrl: String(src.governancePolicyUrl || '').trim() }
      : fb.governancePolicyUrl
        ? { governancePolicyUrl: fb.governancePolicyUrl }
        : {}),
  };
}

function mergeFeatures(input, fallback) {
  const fb = Array.isArray(fallback) ? fallback : [];
  if (!Array.isArray(input)) return fb;

  return input
    .filter((item) => item && typeof item === 'object')
    .map((item, idx) => {
      const rawSurface = String(item.surface || 'interactive_chatbot').trim();
      const rawMarking = String(item.machineReadableMarking || 'none').trim();
      return {
        id: String(item.id || `FEAT-${String(idx + 1).padStart(2, '0')}`).trim(),
        featureName: String(item.featureName || 'AI Feature').trim(),
        surface: isValidAiSurface(rawSurface) ? rawSurface : 'interactive_chatbot',
        providerName: String(item.providerName || 'Internal Provider').trim(),
        modelName: String(item.modelName || 'Custom-AI-v1').trim(),
        ...(item.userFacingUrl ? { userFacingUrl: String(item.userFacingUrl).trim() } : {}),
        publicFacingSinceIso: String(item.publicFacingSinceIso || '2026-08-02').trim(),
        disclosureBannerVisible:
          item.disclosureBannerVisible !== undefined ? Boolean(item.disclosureBannerVisible) : false,
        disclosureWordingEn: String(item.disclosureWordingEn ?? '').trim(),
        disclosureWordingAr: String(item.disclosureWordingAr ?? '').trim(),
        machineReadableMarking: isValidMarkingStandard(rawMarking) ? rawMarking : 'none',
        wcagAccessibleNotice:
          item.wcagAccessibleNotice !== undefined ? Boolean(item.wcagAccessibleNotice) : true,
        interactiveObviousException:
          item.interactiveObviousException !== undefined
            ? Boolean(item.interactiveObviousException)
            : false,
        humanEditorialResponsibilityVerified:
          item.humanEditorialResponsibilityVerified !== undefined
            ? Boolean(item.humanEditorialResponsibilityVerified)
            : false,
        ...(item.editorialOwnerName !== undefined
          ? { editorialOwnerName: String(item.editorialOwnerName || '').trim() }
          : {}),
      };
    });
}

function mergeTrainingRecords(input, fallback) {
  const fb = Array.isArray(fallback) ? fallback : [];
  if (!Array.isArray(input)) return fb;

  return input
    .filter((item) => item && typeof item === 'object')
    .map((item, idx) => {
      const staffCount = Math.max(0, Math.floor(Number(item.staffCount) || 0));
      const rawCompleted = Math.max(0, Math.floor(Number(item.completedCount) || 0));
      const topics = Array.isArray(item.curriculumTopics)
        ? item.curriculumTopics.map((t) => String(t).trim()).filter(Boolean)
        : typeof item.curriculumTopics === 'string'
          ? item.curriculumTopics
              .split(/[;,]/)
              .map((t) => t.trim())
              .filter(Boolean)
          : [];

      return {
        id: String(item.id || `TRN-${String(idx + 1).padStart(2, '0')}`).trim(),
        teamOrRole: String(item.teamOrRole || 'AI Operator Team').trim(),
        staffCount,
        completedCount: Math.min(staffCount, rawCompleted),
        curriculumTopics: topics,
        lastSessionDateIso: String(item.lastSessionDateIso || '2026-08-01').trim(),
        owner: String(item.owner || 'People Operations').trim(),
      };
    });
}

function normalizeControlOverrides(input, fallbackControls = []) {
  const overrides = {};
  if (Array.isArray(fallbackControls)) {
    for (const ctrl of fallbackControls) {
      if (ctrl && typeof ctrl.id === 'string' && VALID_CONTROL_STATUSES.has(ctrl.status)) {
        overrides[ctrl.id] = {
          status: ctrl.status,
          evidenceNote: String(ctrl.evidenceNote ?? ''),
          owner: String(ctrl.owner ?? ''),
        };
      }
    }
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      if (item && typeof item.id === 'string' && VALID_CONTROL_STATUSES.has(item.status)) {
        const prev = overrides[item.id] || {};
        overrides[item.id] = {
          status: item.status,
          evidenceNote:
            item.evidenceNote !== undefined ? String(item.evidenceNote) : (prev.evidenceNote ?? ''),
          owner: item.owner !== undefined ? String(item.owner) : (prev.owner ?? ''),
        };
      }
    }
    return overrides;
  }

  if (input && typeof input === 'object') {
    for (const [id, val] of Object.entries(input)) {
      if (typeof val === 'string' && VALID_CONTROL_STATUSES.has(val)) {
        overrides[id] = val;
      } else if (val && typeof val === 'object' && VALID_CONTROL_STATUSES.has(val.status)) {
        overrides[id] = {
          status: val.status,
          evidenceNote: val.evidenceNote !== undefined ? String(val.evidenceNote) : '',
          ...(val.owner !== undefined ? { owner: String(val.owner) } : {}),
        };
      }
    }
  }

  return overrides;
}

function evaluateDossierCompliance(dossier, referenceDateIso) {
  const auditReport = auditAiTransparencyAndLiteracy(
    dossier.organization,
    dossier.features,
    dossier.trainingRecords,
  );
  const readinessSummary = computeAiDiscloseSummary(
    auditReport,
    dossier.controls,
    referenceDateIso || dossier.referenceDate || dossier.updatedAt,
  );
  return { auditReport, readinessSummary };
}

function buildCsvReportForDossier(dossier, audit) {
  const effectiveAudit =
    audit ||
    auditAiTransparencyAndLiteracy(
      dossier.organization,
      dossier.features,
      dossier.trainingRecords,
    );

  const rows = dossier.features.map((feat, idx) => {
    const featIssues = effectiveAudit.issues.filter((it) => it.featureId === feat.id);
    const editorialExemption =
      feat.surface === 'public_interest_text' &&
      feat.humanEditorialResponsibilityVerified &&
      Boolean((feat.editorialOwnerName || '').trim());

    const bannerSatisfied =
      feat.disclosureBannerVisible ||
      (feat.surface === 'interactive_chatbot' && feat.interactiveObviousException);

    let score = 0;
    if (editorialExemption) {
      score = 100;
    } else {
      if (bannerSatisfied) score += 50;
      if (feat.wcagAccessibleNotice) score += 20;
      const needsMarking =
        feat.surface === 'synthetic_media_image_video_audio' || feat.surface === 'deepfake_media';
      if (!needsMarking || feat.machineReadableMarking !== 'none') score += 30;
    }

    const rowStatus = featIssues.some((it) => it.severity === 'error') ? 'fail' : 'pass';
    return {
      rowNumber: idx + 2,
      featureId: feat.id,
      featureName: feat.featureName,
      surface: feat.surface,
      disclosureBanner: bannerSatisfied,
      machineReadable: feat.machineReadableMarking,
      wcagAccessible: feat.wcagAccessibleNotice,
      editorialExemption,
      status: rowStatus,
      score,
      issues: featIssues,
    };
  });

  const totalRows = rows.length;
  const passedRows = rows.filter((r) => r.status === 'pass').length;
  const failedRows = totalRows - passedRows;
  const averageScore =
    totalRows === 0 ? 0 : Math.round(rows.reduce((sum, r) => sum + r.score, 0) / totalRows);

  return {
    totalRows,
    passedRows,
    failedRows,
    averageScore,
    rows,
  };
}

function serveStaticAsset(res, pathname, resolvedDist, method = 'GET', normalizedBasePath = '') {
  if (!resolvedDist || !fs.existsSync(resolvedDist)) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  let decodedPath = '/';
  try {
    decodedPath = decodeURIComponent(pathname || '/');
  } catch {
    sendJson(res, 400, { error: 'Malformed path' });
    return;
  }

  const cleanRel = decodedPath.replace(/^\/+/, '');
  const candidate = path.resolve(resolvedDist, cleanRel || 'index.html');
  if (candidate !== resolvedDist && !candidate.startsWith(resolvedDist + path.sep)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  let fileToServe = null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    fileToServe = candidate;
  } else {
    const indexFallback = path.join(resolvedDist, 'index.html');
    if (fs.existsSync(indexFallback) && fs.statSync(indexFallback).isFile()) {
      fileToServe = indexFallback;
    }
  }

  if (!fileToServe) {
    sendJson(res, 404, { error: 'Static asset not found' });
    return;
  }

  const ext = path.extname(fileToServe).toLowerCase();
  const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';

  if (ext === '.html' && normalizedBasePath) {
    let html = fs.readFileSync(fileToServe, 'utf8');
    html = html
      .replaceAll('href="/', `href="${normalizedBasePath}/`)
      .replaceAll('src="/', `src="${normalizedBasePath}/`);
    const baseScript = `<script>window.__AIDISCLOSE_BASE__=${JSON.stringify(normalizedBasePath)};</script>`;
    html = html.includes('</head>') ? html.replace('</head>', `${baseScript}</head>`) : `${baseScript}${html}`;
    const bodyBuf = Buffer.from(html, 'utf8');
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': bodyBuf.byteLength,
      'Cache-Control': 'no-cache',
      ...SECURITY_HEADERS,
    });
    if (method === 'HEAD') {
      res.end();
      return;
    }
    res.end(bodyBuf);
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    ...SECURITY_HEADERS,
  });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(fileToServe).pipe(res);
}

function sendAttachment(res, contentType, filename, content) {
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
  });
  res.end(content);
}

function mapCoreErrorStatus(err) {
  if (err?.statusCode) return err.statusCode;
  if (err instanceof AiDiscloseCoreError) return 400;
  return 500;
}

export function createAiDiscloseServer({ dataDir, distDir = '', appOrigin = '', basePath = '' }) {
  const db = openAiDiscloseDatabase(dataDir);
  const resolvedDist = distDir ? path.resolve(distDir) : null;
  const normalizedAppOrigin = String(appOrigin || '').replace(/\/+$/, '');
  const normalizedBasePath = normalizeBasePath(basePath);

  function buildPublicReportUrl(req, slugOrNum) {
    return `${resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath)}/r/${encodeURIComponent(slugOrNum)}`;
  }

  function findStoredDossier(id) {
    return db.getDossierById(id) || db.getDossierBySlugOrNumber(id);
  }

  async function handleApiRequest(req, res, method, pathname, searchParams) {
    // 1. Health & Presets
    if (method === 'GET' && pathname === '/api/health') {
      const stats = db.getStats();
      return sendJson(res, 200, {
        ok: true,
        service: 'aidisclose',
        version: APP_VERSION,
        basePath: normalizedBasePath || '/',
        ...stats,
        timestamp: new Date().toISOString(),
      });
    }

    if (method === 'GET' && pathname === '/api/presets') {
      return sendJson(res, 200, { presets: AIDISCLOSE_PRESETS });
    }

    // 2. Stateless Article 4 & 50 Transparency Auditor + Inventory CSV Auditor
    if (method === 'POST' && pathname === '/api/audit-transparency') {
      const body = await readJsonBody(req);
      const locale = body?.locale === 'ar' ? 'ar' : 'en';
      const refDate =
        typeof body?.referenceDate === 'string' && body.referenceDate.trim()
          ? body.referenceDate.trim()
          : new Date().toISOString();

      const organization = mergeOrganizationProfile(body?.organization, null);
      const features = mergeFeatures(body?.features, []);
      const trainingRecords = mergeTrainingRecords(body?.trainingRecords, []);
      const controls = buildDefaultAiActControls(
        normalizeControlOverrides(body?.controls ?? body?.controlOverrides),
      );

      const auditReport = auditAiTransparencyAndLiteracy(organization, features, trainingRecords);
      const readinessSummary = computeAiDiscloseSummary(auditReport, controls, refDate);
      const previewDossier = {
        id: 'stateless-preview',
        dossierNumber: 'PREVIEW',
        status: 'draft',
        createdAt: refDate,
        updatedAt: refDate,
        scopeDigestHex: '',
        organization,
        features,
        trainingRecords,
        controls,
      };

      return sendJson(res, 200, {
        organization,
        features,
        trainingRecords,
        controls,
        auditReport,
        readinessSummary,
        article50Html: buildArticle50NoticeHtmlSnippet(previewDossier, locale),
        literacyMarkdown: buildArticle4LiteracyRegisterMarkdown(previewDossier, locale),
      });
    }

    if (method === 'POST' && pathname === '/api/inventory-audit') {
      const body = await readJsonBody(req);
      const locale = body?.locale === 'ar' ? 'ar' : 'en';
      const csvText = String(body?.csvText ?? body?.csv ?? '');
      const report = auditAiInventoryCsv(csvText);
      const csvExport = exportAiInventoryCsv(report, locale);
      return sendJson(res, 200, {
        report,
        csvExport,
      });
    }

    // 3. Organization / Governance Profiles CRUD
    if (method === 'GET' && pathname === '/api/profiles') {
      return sendJson(res, 200, { profiles: db.listProfiles() });
    }

    if (method === 'POST' && pathname === '/api/profiles') {
      const body = await readJsonBody(req);
      const created = db.createProfile(body || {});
      return sendJson(res, 201, { profile: created });
    }

    const profileMatch = pathname.match(/^\/api\/profiles\/([^/]+)$/);
    if (profileMatch) {
      const profileId = decodeURIComponent(profileMatch[1] || '');
      if (method === 'PATCH') {
        const body = await readJsonBody(req);
        const updated = db.updateProfile(profileId, body || {});
        if (!updated) return sendJson(res, 404, { error: 'Profile not found' });
        return sendJson(res, 200, { profile: updated });
      }
      if (method === 'DELETE') {
        const del = db.deleteProfile(profileId);
        if (!del.deleted) return sendJson(res, 404, { error: 'Profile not found' });
        return sendJson(res, 200, { deleted: true, id: profileId });
      }
    }

    // 4. Dossiers List & Creation
    if (method === 'GET' && pathname === '/api/dossiers') {
      return sendJson(res, 200, {
        dossiers: db.listDossiers(),
        stats: db.getStats(),
      });
    }

    if (method === 'POST' && pathname === '/api/dossiers') {
      const body = await readJsonBody(req);
      const actor = String(body?.actor || 'governance').trim() || 'governance';
      const refDate =
        typeof body?.referenceDate === 'string' && body.referenceDate.trim()
          ? body.referenceDate.trim()
          : new Date().toISOString();

      if (body?.presetId) {
        const presetMeta = AIDISCLOSE_PRESETS.find((p) => p.id === body.presetId);
        if (!presetMeta) {
          return sendJson(res, 400, { error: 'Unknown presetId', code: 'UNKNOWN_PRESET' });
        }
        const seed = createDossierFromPreset(presetMeta.id, refDate);
        const { auditReport, readinessSummary } = evaluateDossierCompliance(seed, refDate);
        const bundle = db.createDossier(
          {
            ...seed,
            id: undefined,
            slug: body?.slug ? slugify(body.slug, presetMeta.id) : presetMeta.id,
            defaultLocale: body?.defaultLocale === 'ar' ? 'ar' : 'en',
            referenceDate: refDate,
            auditReport,
            readinessSummary,
          },
          actor,
        );
        return sendJson(res, 201, {
          ...bundle,
          publicReportUrl: buildPublicReportUrl(req, bundle.dossier.slug),
        });
      }

      if (!body?.organization && !Array.isArray(body?.features) && !Array.isArray(body?.trainingRecords)) {
        return sendJson(res, 400, {
          error: 'Provide presetId or custom organization / features / trainingRecords dossier payload.',
          code: 'MISSING_DOSSIER_INPUT',
        });
      }

      const defaultLocale = body?.defaultLocale === 'ar' ? 'ar' : 'en';
      const organization = mergeOrganizationProfile(body?.organization, null);
      const features = mergeFeatures(body?.features, []);
      const trainingRecords = mergeTrainingRecords(body?.trainingRecords, []);
      const controls = buildDefaultAiActControls(
        normalizeControlOverrides(body?.controls ?? body?.controlOverrides),
      );

      const candidate = {
        slug: slugify(body?.slug || organization.legalName, 'dossier'),
        defaultLocale,
        referenceDate: refDate,
        organization,
        features,
        trainingRecords,
        controls,
      };
      const { auditReport, readinessSummary } = evaluateDossierCompliance(candidate, refDate);

      const bundle = db.createDossier(
        {
          ...candidate,
          auditReport,
          readinessSummary,
        },
        actor,
      );

      return sendJson(res, 201, {
        ...bundle,
        publicReportUrl: buildPublicReportUrl(req, bundle.dossier.slug),
      });
    }

    // 5. Dossier Actions: Duplicate & Finalize / Lock
    const dupMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/duplicate$/);
    if (method === 'POST' && dupMatch) {
      const id = decodeURIComponent(dupMatch[1] || '');
      const body = await readJsonBody(req);
      const cloned = db.duplicateDossier(id, String(body?.actor || 'governance').trim() || 'governance');
      if (!cloned) return sendJson(res, 404, { error: 'Dossier not found' });
      return sendJson(res, 201, {
        ...cloned,
        publicReportUrl: buildPublicReportUrl(req, cloned.dossier.slug),
      });
    }

    const finalizeMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/(finalize|lock)$/);
    if (method === 'POST' && finalizeMatch) {
      const id = decodeURIComponent(finalizeMatch[1] || '');
      const body = await readJsonBody(req);
      const actor = String(body?.actor || 'governance').trim() || 'governance';
      const lockedBundle = db.finalizeDossier(id, buildDossierCanonicalText, actor);
      if (!lockedBundle) return sendJson(res, 404, { error: 'Dossier not found' });
      return sendJson(res, 200, {
        ...lockedBundle,
        publicReportUrl: buildPublicReportUrl(
          req,
          lockedBundle.dossier.dossierNumber || lockedBundle.dossier.slug,
        ),
      });
    }

    // 6. Exports & Summary (Art. 50 HTML+JSON-LD, Art. 4 Markdown Register, BOM CSV, Executive Summary)
    const art50Match = pathname.match(/^\/api\/dossiers\/([^/]+)\/article50\.html$/);
    if (method === 'GET' && art50Match) {
      const bundle = findStoredDossier(decodeURIComponent(art50Match[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'ar' ? 'ar' : 'en';
      const d = bundle.dossier;
      const fname = slugify(d.dossierNumber || d.slug || d.id, 'dossier');
      return sendAttachment(
        res,
        'text/html; charset=utf-8',
        `aidisclose-${fname}-article50-${locale}.html`,
        buildArticle50NoticeHtmlSnippet(d, locale),
      );
    }

    const literacyMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/literacy\.md$/);
    if (method === 'GET' && literacyMatch) {
      const bundle = findStoredDossier(decodeURIComponent(literacyMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'ar' ? 'ar' : 'en';
      const d = bundle.dossier;
      const fname = slugify(d.dossierNumber || d.slug || d.id, 'dossier');
      return sendAttachment(
        res,
        'text/markdown; charset=utf-8',
        `aidisclose-${fname}-article4-literacy-${locale}.md`,
        buildArticle4LiteracyRegisterMarkdown(d, locale),
      );
    }

    const csvMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/export\.csv$/);
    if (method === 'GET' && csvMatch) {
      const bundle = findStoredDossier(decodeURIComponent(csvMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'ar' ? 'ar' : 'en';
      const d = bundle.dossier;
      const report = buildCsvReportForDossier(d, d.auditReport);
      const fname = slugify(d.dossierNumber || d.slug || d.id, 'dossier');
      return sendAttachment(
        res,
        'text/csv; charset=utf-8',
        `aidisclose-${fname}-ai-inventory-${locale}.csv`,
        exportAiInventoryCsv(report, locale),
      );
    }

    const summaryMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/summary$/);
    if (method === 'GET' && summaryMatch) {
      const bundle = findStoredDossier(decodeURIComponent(summaryMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'ar' ? 'ar' : 'en';
      const d = bundle.dossier;
      const { auditReport, readinessSummary } =
        d.auditReport && d.readinessSummary
          ? { auditReport: d.auditReport, readinessSummary: d.readinessSummary }
          : evaluateDossierCompliance(d);
      return sendJson(res, 200, {
        locale,
        summary: buildExecutiveSummaryText(d, auditReport, readinessSummary, locale),
      });
    }

    // 7. Single Dossier Read, Update & Delete
    const dossierMatch = pathname.match(/^\/api\/dossiers\/([^/]+)$/);
    if (dossierMatch) {
      const id = decodeURIComponent(dossierMatch[1] || '');
      if (method === 'GET') {
        const bundle = findStoredDossier(id);
        if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, {
          ...bundle,
          publicReportUrl: buildPublicReportUrl(
            req,
            bundle.dossier.dossierNumber || bundle.dossier.slug,
          ),
        });
      }
      if (method === 'PATCH') {
        const patch = await readJsonBody(req);
        const updated = db.updateDossier(
          id,
          (current) => {
            const nextOrganization = patch?.organization
              ? mergeOrganizationProfile(patch.organization, current.organization)
              : current.organization;

            const nextFeatures = patch?.features !== undefined
              ? mergeFeatures(patch.features, current.features)
              : current.features;

            const nextTrainingRecords = patch?.trainingRecords !== undefined
              ? mergeTrainingRecords(patch.trainingRecords, current.trainingRecords)
              : current.trainingRecords;

            const controlInput = patch?.controls ?? patch?.controlOverrides;
            const nextControls = controlInput !== undefined
              ? buildDefaultAiActControls(normalizeControlOverrides(controlInput, current.controls))
              : current.controls;

            const nextRefDate =
              typeof patch?.referenceDate === 'string' && patch.referenceDate.trim()
                ? patch.referenceDate.trim()
                : current.referenceDate;

            const nextDraft = {
              ...current,
              ...(typeof patch?.slug === 'string' && patch.slug.trim() ? { slug: patch.slug.trim() } : {}),
              ...(patch?.defaultLocale === 'ar' || patch?.defaultLocale === 'en'
                ? { defaultLocale: patch.defaultLocale }
                : {}),
              referenceDate: nextRefDate,
              organization: nextOrganization,
              features: nextFeatures,
              trainingRecords: nextTrainingRecords,
              controls: nextControls,
            };

            const { auditReport, readinessSummary } = evaluateDossierCompliance(nextDraft, nextRefDate);
            return {
              ...nextDraft,
              auditReport,
              readinessSummary,
            };
          },
          String(patch?.actor || 'governance').trim() || 'governance',
        );
        if (!updated) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, {
          ...updated,
          publicReportUrl: buildPublicReportUrl(req, updated.dossier.slug),
        });
      }
      if (method === 'DELETE') {
        const del = db.deleteDossier(id);
        if (!del.deleted) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, { deleted: true, id: del.id });
      }
    }

    // 8. Public Shareable EU AI Act Dossier (/api/public/reports/:slugOrNumber)
    const pubMatch = pathname.match(/^\/api\/public\/reports\/([^/]+)$/);
    if (method === 'GET' && pubMatch) {
      const slugOrNumber = decodeURIComponent(pubMatch[1] || '');
      const bundle = db.getDossierBySlugOrNumber(slugOrNumber, { incrementView: true });
      if (!bundle) return sendJson(res, 404, { error: 'Readiness dossier not found' });
      const d = bundle.dossier;
      const { auditReport, readinessSummary } =
        d.auditReport && d.readinessSummary
          ? { auditReport: d.auditReport, readinessSummary: d.readinessSummary }
          : evaluateDossierCompliance(d);
      return sendJson(res, 200, {
        ...bundle,
        summaryEn: buildExecutiveSummaryText(d, auditReport, readinessSummary, 'en'),
        summaryAr: buildExecutiveSummaryText(d, auditReport, readinessSummary, 'ar'),
        article50HtmlEn: buildArticle50NoticeHtmlSnippet(d, 'en'),
        article50HtmlAr: buildArticle50NoticeHtmlSnippet(d, 'ar'),
        literacyMarkdownEn: buildArticle4LiteracyRegisterMarkdown(d, 'en'),
        literacyMarkdownAr: buildArticle4LiteracyRegisterMarkdown(d, 'ar'),
        publicReportUrl: buildPublicReportUrl(req, d.dossierNumber || d.slug),
      });
    }

    return sendJson(res, 404, { error: 'API endpoint not found' });
  }

  async function handler(req, res) {
    try {
      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      let pathname = parsedUrl.pathname;
      if (
        normalizedBasePath &&
        (pathname === normalizedBasePath || pathname.startsWith(`${normalizedBasePath}/`))
      ) {
        pathname = pathname.slice(normalizedBasePath.length) || '/';
      }
      const method = String(req.method || 'GET').toUpperCase();

      if (pathname.startsWith('/api/')) {
        await handleApiRequest(req, res, method, pathname, parsedUrl.searchParams);
        return;
      }

      if (method !== 'GET' && method !== 'HEAD') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      serveStaticAsset(res, pathname, resolvedDist, method, normalizedBasePath);
    } catch (err) {
      const statusCode = mapCoreErrorStatus(err);
      const payload = {
        error: err?.message || 'Internal server error',
        ...(err?.code ? { code: err.code } : {}),
      };
      if (!res.headersSent) {
        sendJson(res, statusCode, payload);
      } else {
        res.end();
      }
    }
  }

  return {
    handler,
    close: () => db.close(),
  };
}
