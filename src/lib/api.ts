import { auditAiInventoryCsv, auditAiTransparencyAndLiteracy, exportAiInventoryCsv } from '../core/disclosureAuditor.ts';
import {
  buildDossierCanonicalText,
  buildExecutiveSummaryText,
  sealAiDiscloseDossier,
} from '../core/dossierDigest.ts';
import {
  buildArticle4LiteracyRegisterMarkdown,
  buildArticle50NoticeHtmlSnippet,
  computeAiDiscloseSummary,
} from '../core/noticeAndLiteracy.ts';
import {
  AIDISCLOSE_PRESETS,
  createDossierFromPreset,
  type AiDisclosePresetId,
  type AiDisclosePresetMeta,
} from '../core/presets.ts';
import type {
  AiDiscloseDossier,
  InventoryCsvAuditReport,
  Locale,
  OrganizationAiProfile,
} from '../core/types.ts';
import { withBase } from './basePath.ts';

export interface DossierListRecord {
  id: string;
  slug: string;
  dossierNumber: string | null;
  status: 'draft' | 'locked';
  operatorRole: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  dossier: AiDiscloseDossier;
}

export interface DossierStats {
  totalDossiers: number;
  draftDossiers: number;
  lockedDossiers: number;
  orgProfilesCount: number;
}

export interface DossierBundle {
  dossier: AiDiscloseDossier;
  viewCount: number;
  publicReportUrl?: string;
  summaryEn?: string;
  summaryAr?: string;
  article50HtmlEn?: string;
  article50HtmlAr?: string;
  literacyMarkdownEn?: string;
  literacyMarkdownAr?: string;
}

export interface OrgProfileRecord {
  id: string;
  name: string;
  profile: OrganizationAiProfile;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const LOCAL_STORE_KEY = 'aidisclose_local_store_v1';

interface LocalStoreState {
  seqByYear: Record<string, number>;
  dossiers: Array<{ dossier: AiDiscloseDossier; viewCount: number }>;
  profiles: OrgProfileRecord[];
}

function readLocalStore(): LocalStoreState {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalStoreState;
      if (parsed && Array.isArray(parsed.dossiers)) {
        return {
          seqByYear: parsed.seqByYear || {},
          dossiers: parsed.dossiers,
          profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
        };
      }
    }
  } catch {
    // ignore storage read errors
  }
  return { seqByYear: {}, dossiers: [], profiles: [] };
}

function writeLocalStore(state: LocalStoreState) {
  try {
    window.localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage write errors
  }
}

function localSlugify(text: string): string {
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'dossier';
}

export function recomputeLocalDossierMetrics(dossier: AiDiscloseDossier): AiDiscloseDossier {
  const auditReport = auditAiTransparencyAndLiteracy(
    dossier.organization,
    dossier.features,
    dossier.trainingRecords,
  );
  const readinessSummary = computeAiDiscloseSummary(
    auditReport,
    dossier.controls,
    dossier.referenceDate || dossier.updatedAt,
  );
  return {
    ...dossier,
    auditReport,
    readinessSummary,
  };
}

function enrichBundle(dossier: AiDiscloseDossier, viewCount = 0): DossierBundle {
  const hydrated = recomputeLocalDossierMetrics(dossier);
  const audit = hydrated.auditReport!;
  const summary = hydrated.readinessSummary!;
  return {
    dossier: hydrated,
    viewCount,
    summaryEn: buildExecutiveSummaryText(hydrated, audit, summary, 'en'),
    summaryAr: buildExecutiveSummaryText(hydrated, audit, summary, 'ar'),
    article50HtmlEn: buildArticle50NoticeHtmlSnippet(hydrated, 'en'),
    article50HtmlAr: buildArticle50NoticeHtmlSnippet(hydrated, 'ar'),
    literacyMarkdownEn: buildArticle4LiteracyRegisterMarkdown(hydrated, 'en'),
    literacyMarkdownAr: buildArticle4LiteracyRegisterMarkdown(hydrated, 'ar'),
    publicReportUrl: `${window.location.origin}${withBase(`/r/${encodeURIComponent(hydrated.dossierNumber || hydrated.slug || hydrated.id)}`)}`,
  };
}

function buildLocalStats(state: LocalStoreState): DossierStats {
  const totalDossiers = state.dossiers.length;
  const lockedDossiers = state.dossiers.filter((entry) => entry.dossier.status === 'locked').length;
  return {
    totalDossiers,
    draftDossiers: totalDossiers - lockedDossiers,
    lockedDossiers,
    orgProfilesCount: state.profiles.length,
  };
}

function isStaticFallbackCandidate(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 404 || err.status === 405 || err.status >= 502;
  }
  return true;
}

async function requestJson<T>(urlPath: string, init?: RequestInit): Promise<T> {
  const res = await fetch(withBase(urlPath), init);
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new ApiError(`Invalid non-JSON response (${res.status})`, res.status);
    }
  }
  if (!res.ok) {
    throw new ApiError(
      String(parsed.error || `Request failed (${res.status})`),
      res.status,
      typeof parsed.code === 'string' ? parsed.code : undefined,
    );
  }
  return parsed as T;
}

export async function detectServerHealth(): Promise<{ online: boolean; version: string }> {
  try {
    const res = await requestJson<{ ok: boolean; service: string; version: string }>('/api/health');
    if (res.ok && res.service === 'aidisclose') {
      return { online: true, version: res.version };
    }
  } catch {
    // fallback to static browser mode
  }
  return { online: false, version: '0.3.0-local' };
}

export async function fetchPresets(): Promise<readonly AiDisclosePresetMeta[]> {
  try {
    const res = await requestJson<{ presets: AiDisclosePresetMeta[] }>('/api/presets');
    return res.presets;
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    return AIDISCLOSE_PRESETS;
  }
}

export async function listDossiers(): Promise<{ dossiers: DossierListRecord[]; stats: DossierStats }> {
  try {
    return await requestJson<{ dossiers: DossierListRecord[]; stats: DossierStats }>('/api/dossiers');
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    return {
      dossiers: state.dossiers.map(({ dossier, viewCount }) => ({
        id: dossier.id,
        slug: dossier.slug || dossier.id,
        dossierNumber: dossier.dossierNumber || null,
        status: dossier.status,
        operatorRole: dossier.organization.operatorRole,
        viewCount,
        createdAt: dossier.createdAt,
        updatedAt: dossier.updatedAt,
        dossier,
      })),
      stats: buildLocalStats(state),
    };
  }
}

export async function createDossierFromPresetApi(
  presetId: AiDisclosePresetId,
  defaultLocale: Locale = 'en',
): Promise<DossierBundle> {
  try {
    return await requestJson<DossierBundle>('/api/dossiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId, defaultLocale }),
    });
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    const now = new Date().toISOString();
    const seed = createDossierFromPreset(presetId, now);
    const id = `aid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const dossier = recomputeLocalDossierMetrics({
      ...seed,
      id,
      slug: `${localSlugify(presetId)}-${id.slice(-4)}`,
      dossierNumber: '',
      scopeDigestHex: '',
      status: 'draft',
      defaultLocale,
      createdAt: now,
      updatedAt: now,
    });
    state.dossiers.unshift({ dossier, viewCount: 0 });
    writeLocalStore(state);
    return enrichBundle(dossier, 0);
  }
}

export async function getDossier(idOrSlug: string): Promise<DossierBundle> {
  try {
    return await requestJson<DossierBundle>(`/api/dossiers/${encodeURIComponent(idOrSlug)}`);
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    const found = state.dossiers.find(
      (entry) =>
        entry.dossier.id === idOrSlug ||
        entry.dossier.slug === idOrSlug ||
        entry.dossier.dossierNumber === idOrSlug,
    );
    if (!found) throw new ApiError('Dossier not found locally', 404);
    return enrichBundle(found.dossier, found.viewCount);
  }
}

export async function getPublicDossier(slugOrNumber: string): Promise<DossierBundle> {
  try {
    return await requestJson<DossierBundle>(`/api/public/reports/${encodeURIComponent(slugOrNumber)}`);
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    const found = state.dossiers.find(
      (entry) =>
        entry.dossier.slug === slugOrNumber ||
        entry.dossier.dossierNumber === slugOrNumber ||
        entry.dossier.id === slugOrNumber,
    );
    if (!found) throw new ApiError('Public dossier not found', 404);
    found.viewCount += 1;
    writeLocalStore(state);
    return enrichBundle(found.dossier, found.viewCount);
  }
}

export async function saveDossierDraft(dossier: AiDiscloseDossier): Promise<DossierBundle> {
  const payload = {
    defaultLocale: dossier.defaultLocale,
    referenceDate: dossier.referenceDate,
    organization: dossier.organization,
    features: dossier.features,
    trainingRecords: dossier.trainingRecords,
    controls: dossier.controls,
  };
  try {
    return await requestJson<DossierBundle>(`/api/dossiers/${encodeURIComponent(dossier.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    const idx = state.dossiers.findIndex((entry) => entry.dossier.id === dossier.id);
    if (idx === -1) throw new ApiError('Dossier not found locally', 404);
    const current = state.dossiers[idx];
    if (!current || current.dossier.status === 'locked') {
      throw new ApiError('Locked dossier cannot be modified', 409, 'DOSSIER_LOCKED');
    }
    const updated = recomputeLocalDossierMetrics({
      ...dossier,
      updatedAt: new Date().toISOString(),
    });
    state.dossiers[idx] = { dossier: updated, viewCount: current.viewCount };
    writeLocalStore(state);
    return enrichBundle(updated, current.viewCount);
  }
}

export async function duplicateDossierApi(id: string): Promise<DossierBundle> {
  try {
    return await requestJson<DossierBundle>(`/api/dossiers/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    const src = state.dossiers.find((entry) => entry.dossier.id === id);
    if (!src) throw new ApiError('Dossier not found locally', 404);
    const now = new Date().toISOString();
    const newId = `aid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const cloned = recomputeLocalDossierMetrics({
      ...src.dossier,
      id: newId,
      slug: `${localSlugify(src.dossier.slug || src.dossier.organization.legalName)}-copy-${newId.slice(-4)}`,
      dossierNumber: '',
      scopeDigestHex: '',
      lockedAt: undefined,
      status: 'draft',
      organization: {
        ...src.dossier.organization,
        legalName: `${src.dossier.organization.legalName} (Copy)`,
      },
      createdAt: now,
      updatedAt: now,
    });
    state.dossiers.unshift({ dossier: cloned, viewCount: 0 });
    writeLocalStore(state);
    return enrichBundle(cloned, 0);
  }
}

export async function finalizeDossierApi(id: string): Promise<DossierBundle> {
  try {
    return await requestJson<DossierBundle>(`/api/dossiers/${encodeURIComponent(id)}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    const idx = state.dossiers.findIndex((entry) => entry.dossier.id === id);
    if (idx === -1) throw new ApiError('Dossier not found locally', 404);
    const current = state.dossiers[idx];
    if (!current || current.dossier.status === 'locked') {
      throw new ApiError('Dossier is already finalized', 409, 'ALREADY_LOCKED');
    }
    const year = String(new Date().getUTCFullYear());
    const nextSeq = (state.seqByYear[year] || 0) + 1;
    state.seqByYear[year] = nextSeq;
    const dossierNumber = `AID-${year}-${String(nextSeq).padStart(4, '0')}`;
    const numbered: AiDiscloseDossier = {
      ...current.dossier,
      dossierNumber,
    };
    buildDossierCanonicalText(numbered);
    const locked = await sealAiDiscloseDossier(numbered);
    state.dossiers[idx] = { dossier: locked, viewCount: current.viewCount };
    writeLocalStore(state);
    return enrichBundle(locked, current.viewCount);
  }
}

export async function deleteDossierApi(id: string): Promise<{ deleted: boolean; id: string }> {
  try {
    return await requestJson<{ deleted: boolean; id: string }>(
      `/api/dossiers/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    const target = state.dossiers.find((entry) => entry.dossier.id === id);
    if (!target) throw new ApiError('Dossier not found locally', 404);
    if (target.dossier.status === 'locked') {
      throw new ApiError('Locked dossier cannot be deleted', 409, 'DOSSIER_LOCKED');
    }
    state.dossiers = state.dossiers.filter((entry) => entry.dossier.id !== id);
    writeLocalStore(state);
    return { deleted: true, id };
  }
}

export async function auditInventoryCsvApi(
  csvText: string,
  locale: Locale,
): Promise<{ report: InventoryCsvAuditReport; csvExport: string }> {
  try {
    return await requestJson<{ report: InventoryCsvAuditReport; csvExport: string }>(
      '/api/inventory-audit',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, locale }),
      },
    );
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const report = auditAiInventoryCsv(csvText);
    const csvExport = exportAiInventoryCsv(report, locale);
    return { report, csvExport };
  }
}

export async function listProfilesApi(): Promise<OrgProfileRecord[]> {
  try {
    const res = await requestJson<{ profiles: OrgProfileRecord[] }>('/api/profiles');
    return res.profiles;
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    return readLocalStore().profiles;
  }
}

export async function createProfileApi(input: OrganizationAiProfile): Promise<OrgProfileRecord> {
  try {
    const res = await requestJson<{ profile: OrgProfileRecord }>('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return res.profile;
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    const now = new Date().toISOString();
    const created: OrgProfileRecord = {
      id: `org-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: input.legalName,
      profile: input,
      createdAt: now,
      updatedAt: now,
    };
    state.profiles.unshift(created);
    writeLocalStore(state);
    return created;
  }
}

export async function deleteProfileApi(id: string): Promise<void> {
  try {
    await requestJson<{ deleted: boolean }>(`/api/profiles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    state.profiles = state.profiles.filter((item) => item.id !== id);
    writeLocalStore(state);
  }
}
