import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createAiDiscloseServer } from '../../server/app.mjs';
import { verifyDossierIntegrity } from '../../src/core/dossierDigest.ts';
import type { AiDiscloseDossier } from '../../src/core/types.ts';

interface RunningTestServer {
  baseUrl: string;
  dataDir: string;
  distDir: string;
  stop: () => Promise<void>;
}

const activeServers: RunningTestServer[] = [];

async function startTestServer(
  options: { basePath?: string; withFakeDist?: boolean } = {},
): Promise<RunningTestServer> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aidisclose-test-'));
  const dataDir = path.join(tempRoot, 'data');
  const distDir = options.withFakeDist ? path.join(tempRoot, 'dist') : '';
  if (options.withFakeDist) {
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(distDir, 'index.html'),
      '<!doctype html><html><head><title>AIDisclose</title><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>',
      'utf8',
    );
  }

  const { handler, close } = createAiDiscloseServer({
    dataDir,
    distDir,
    basePath: options.basePath ?? '',
  });
  const server = http.createServer(handler);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  const handle: RunningTestServer = {
    baseUrl,
    dataDir,
    distDir,
    stop: async () => {
      close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(tempRoot, { recursive: true, force: true });
    },
  };
  activeServers.push(handle);
  return handle;
}

afterEach(async () => {
  while (activeServers.length > 0) {
    const srv = activeServers.pop();
    if (srv) {
      await srv.stop();
    }
  }
});

async function apiJson<T>(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; headers: Headers; data: T }> {
  const res = await fetch(url, init);
  const data = (await res.json()) as T;
  return { status: res.status, headers: res.headers, data };
}

describe('AIDisclose Node 22 + SQLite WAL HTTP API integration', () => {
  it('serves /api/health and /api/presets with security headers', async () => {
    const srv = await startTestServer();

    const health = await apiJson<{
      ok: boolean;
      service: string;
      version: string;
      basePath: string;
      totalDossiers: number;
    }>(`${srv.baseUrl}/api/health`);

    expect(health.status).toBe(200);
    expect(health.headers.get('x-content-type-options')).toBe('nosniff');
    expect(health.headers.get('referrer-policy')).toBe('same-origin');
    expect(health.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    const pkg = JSON.parse(
      fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    expect(health.data.ok).toBe(true);
    expect(health.data.service).toBe('aidisclose');
    expect(health.data.version).toBe(pkg.version);
    expect(health.data.basePath).toBe('/');
    expect(health.data.totalDossiers).toBe(0);

    const presets = await apiJson<{ presets: Array<{ id: string }> }>(`${srv.baseUrl}/api/presets`);
    expect(presets.status).toBe(200);
    expect(presets.data.presets).toHaveLength(3);
  });

  it('audits AI inventory CSVs & stateless transparency and maps AiDiscloseCoreError to 400', async () => {
    const srv = await startTestServer();

    const csvPayload = [
      'feature_id,feature_name,surface,disclosure_banner,machine_readable,wcag_accessible,editorial_review_owner',
      'BOT-01,Support Copilot,interactive_chatbot,true,html_meta_tag,true,',
      'IMG-02,Promo Reel,deepfake_media,false,none,false,',
      'NEWS-03,Policy Wire,public_interest_text,false,none,true,Managing Desk Editor',
    ].join('\n');

    const csvAudit = await apiJson<{
      report: { totalRows: number; passedRows: number; failedRows: number };
      csvExport: string;
    }>(`${srv.baseUrl}/api/inventory-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText: csvPayload, locale: 'en' }),
    });
    expect(csvAudit.status).toBe(200);
    expect(csvAudit.data.report.totalRows).toBe(3);
    expect(csvAudit.data.report.passedRows).toBe(2);
    expect(csvAudit.data.report.failedRows).toBe(1);
    expect(csvAudit.data.csvExport.startsWith('\uFEFF')).toBe(true);

    const emptyErr = await apiJson<{ code: string }>(`${srv.baseUrl}/api/inventory-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText: '   ' }),
    });
    expect(emptyErr.status).toBe(400);
    expect(emptyErr.data.code).toBe('EMPTY_CSV');

    const badHeaderErr = await apiJson<{ code: string }>(`${srv.baseUrl}/api/inventory-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText: 'wrong_col\nvalue' }),
    });
    expect(badHeaderErr.status).toBe(400);
    expect(badHeaderErr.data.code).toBe('INVALID_CSV_HEADER');

    const statelessAudit = await apiJson<{
      auditReport: { disclosureScore: number; literacyCompletionPct: number };
      readinessSummary: { overallScore: number; readinessTier: string };
      article50Html: string;
      literacyMarkdown: string;
    }>(`${srv.baseUrl}/api/audit-transparency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale: 'en',
        referenceDate: '2026-09-15T00:00:00.000Z',
        organization: {
          legalName: 'NordCloud AI GmbH',
          contactEmail: 'gov@nordcloud.eu',
          countryCode: 'DE',
          operatorRole: 'both',
          dpoOrGovLead: 'Mia Lindemann',
        },
        features: [
          {
            id: 'FEAT-01',
            featureName: 'Helpdesk Chatbot',
            surface: 'interactive_chatbot',
            providerName: 'NordCloud',
            modelName: 'NC-Chat-2',
            disclosureBannerVisible: true,
            disclosureWordingEn: 'AI-powered assistant.',
            disclosureWordingAr: 'مساعد بالذكاء الاصطناعي.',
            machineReadableMarking: 'html_meta_tag',
            wcagAccessibleNotice: true,
            interactiveObviousException: false,
            humanEditorialResponsibilityVerified: false,
          },
        ],
        trainingRecords: [
          {
            id: 'TRN-01',
            teamOrRole: 'Support & Product',
            staffCount: 10,
            completedCount: 10,
            curriculumTopics: ['Art. 4 AI Literacy', 'Human Oversight & PII'],
            lastSessionDateIso: '2026-08-10',
            owner: 'Mia Lindemann',
          },
        ],
      }),
    });
    expect(statelessAudit.status).toBe(200);
    expect(statelessAudit.data.auditReport.disclosureScore).toBe(100);
    expect(statelessAudit.data.auditReport.literacyCompletionPct).toBe(100);
    expect(statelessAudit.data.article50Html).toContain('application/ld+json');
    expect(statelessAudit.data.literacyMarkdown).toContain('NordCloud AI GmbH');
  });

  it('supports CRUD for reusable Organization / AI Governance profiles', async () => {
    const srv = await startTestServer();

    const created = await apiJson<{
      profile: { id: string; name: string; profile: { legalName: string; operatorRole: string } };
    }>(`${srv.baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        legalName: 'Alpine Civic Media AG',
        contactEmail: 'ai-gov@alpine-media.eu',
        countryCode: 'AT',
        operatorRole: 'deployer',
        dpoOrGovLead: 'Lukas Berger',
      }),
    });
    expect(created.status).toBe(201);
    const id = created.data.profile.id;
    expect(created.data.profile.profile.legalName).toBe('Alpine Civic Media AG');

    const listed = await apiJson<{ profiles: Array<{ id: string }> }>(`${srv.baseUrl}/api/profiles`);
    expect(listed.status).toBe(200);
    expect(listed.data.profiles).toHaveLength(1);

    const patched = await apiJson<{ profile: { profile: { operatorRole: string; dpoOrGovLead: string } } }>(
      `${srv.baseUrl}/api/profiles/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorRole: 'both', dpoOrGovLead: 'Elena Novak' }),
      },
    );
    expect(patched.status).toBe(200);
    expect(patched.data.profile.profile.operatorRole).toBe('both');
    expect(patched.data.profile.profile.dpoOrGovLead).toBe('Elena Novak');

    const deleted = await apiJson<{ deleted: boolean }>(
      `${srv.baseUrl}/api/profiles/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    expect(deleted.status).toBe(200);
    expect(deleted.data.deleted).toBe(true);

    const missing = await apiJson<{ error: string }>(
      `${srv.baseUrl}/api/profiles/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    expect(missing.status).toBe(404);
  });

  it('creates preset & custom dossiers, validates inputs, updates draft, and deletes draft', async () => {
    const srv = await startTestServer();

    const missingErr = await apiJson<{ code: string }>(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(missingErr.status).toBe(400);
    expect(missingErr.data.code).toBe('MISSING_DOSSIER_INPUT');

    const badPreset = await apiJson<{ code: string }>(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: 'does-not-exist' }),
    });
    expect(badPreset.status).toBe(400);
    expect(badPreset.data.code).toBe('UNKNOWN_PRESET');

    const newsroom = await apiJson<{
      dossier: AiDiscloseDossier;
      publicReportUrl: string;
    }>(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presetId: 'media-newsroom-gaps',
        referenceDate: '2026-09-01T00:00:00.000Z',
        actor: 'compliance-officer',
      }),
    });
    expect(newsroom.status).toBe(201);
    const id = newsroom.data.dossier.id;
    const beforeScore = newsroom.data.dossier.readinessSummary?.overallScore ?? 0;
    expect(newsroom.data.dossier.readinessSummary?.readinessTier).toBe('blocked');

    const patched = await apiJson<{ dossier: AiDiscloseDossier }>(
      `${srv.baseUrl}/api/dossiers/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features: newsroom.data.dossier.features.map((feat) => ({
            ...feat,
            disclosureBannerVisible: true,
            disclosureWordingEn: 'Synthetic / AI-assisted newsroom content with verified oversight.',
            machineReadableMarking: 'c2pa_provenance',
            wcagAccessibleNotice: true,
            humanEditorialResponsibilityVerified: feat.surface === 'public_interest_text',
            editorialOwnerName:
              feat.surface === 'public_interest_text' ? 'Chief Desk Editor' : undefined,
          })),
          trainingRecords: [
            {
              id: 'TRN-NEWS-1',
              teamOrRole: 'Editorial & Video Studio',
              staffCount: 20,
              completedCount: 20,
              curriculumTopics: ['Art. 4 AI Literacy', 'Art. 50(4) Editorial Oversight', 'C2PA Marking'],
              lastSessionDateIso: '2026-08-25',
              owner: 'Managing Editor',
            },
          ],
        }),
      },
    );
    expect(patched.status).toBe(200);
    expect(patched.data.dossier.readinessSummary?.overallScore ?? 0).toBeGreaterThan(beforeScore);

    const custom = await apiJson<{ dossier: AiDiscloseDossier }>(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'custom-draft-check',
        organization: {
          legalName: 'Custom Draft Studio Oy',
          contactEmail: 'ai@custom-draft.fi',
          countryCode: 'FI',
          operatorRole: 'provider',
          dpoOrGovLead: 'Sanna Korhonen',
        },
        features: [],
        trainingRecords: [],
      }),
    });
    expect(custom.status).toBe(201);

    const listed = await apiJson<{
      dossiers: Array<{ id: string }>;
      stats: { totalDossiers: number; draftDossiers: number };
    }>(`${srv.baseUrl}/api/dossiers`);
    expect(listed.data.stats.totalDossiers).toBe(2);
    expect(listed.data.stats.draftDossiers).toBe(2);

    const delCustom = await apiJson<{ deleted: boolean }>(
      `${srv.baseUrl}/api/dossiers/${encodeURIComponent(custom.data.dossier.id)}`,
      { method: 'DELETE' },
    );
    expect(delCustom.status).toBe(200);
    expect(delCustom.data.deleted).toBe(true);
  });

  it('assigns atomic AID-YYYY-NNNN numbers, verifies SHA-256 digest, enforces 409 lock, and duplicates cleanly', async () => {
    const srv = await startTestServer();
    const year = new Date().getUTCFullYear();

    const p1 = await apiJson<{ dossier: AiDiscloseDossier }>(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: 'saas-copilot-compliant' }),
    });
    const p2 = await apiJson<{ dossier: AiDiscloseDossier }>(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: 'hr-emotion-biometric-drill' }),
    });

    const fin1 = await apiJson<{ dossier: AiDiscloseDossier }>(
      `${srv.baseUrl}/api/dossiers/${encodeURIComponent(p1.data.dossier.id)}/finalize`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: 'ciso' }) },
    );
    expect(fin1.status).toBe(200);
    expect(fin1.data.dossier.dossierNumber).toBe(`AID-${year}-0001`);
    expect(fin1.data.dossier.status).toBe('locked');
    expect(fin1.data.dossier.scopeDigestHex).toHaveLength(64);
    expect((await verifyDossierIntegrity(fin1.data.dossier)).valid).toBe(true);

    const fin2 = await apiJson<{ dossier: AiDiscloseDossier }>(
      `${srv.baseUrl}/api/dossiers/${encodeURIComponent(p2.data.dossier.id)}/lock`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: 'dpo' }) },
    );
    expect(fin2.status).toBe(200);
    expect(fin2.data.dossier.dossierNumber).toBe(`AID-${year}-0002`);
    expect((await verifyDossierIntegrity(fin2.data.dossier)).valid).toBe(true);

    const mutateLocked = await apiJson<{ code: string }>(
      `${srv.baseUrl}/api/dossiers/${encodeURIComponent(p1.data.dossier.id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization: { legalName: 'Tampered Corp' } }),
      },
    );
    expect(mutateLocked.status).toBe(409);
    expect(mutateLocked.data.code).toBe('DOSSIER_LOCKED');

    const deleteLocked = await apiJson<{ code: string }>(
      `${srv.baseUrl}/api/dossiers/${encodeURIComponent(p1.data.dossier.id)}`,
      { method: 'DELETE' },
    );
    expect(deleteLocked.status).toBe(409);
    expect(deleteLocked.data.code).toBe('DOSSIER_LOCKED');

    const refinalize = await apiJson<{ code: string }>(
      `${srv.baseUrl}/api/dossiers/${encodeURIComponent(p1.data.dossier.id)}/finalize`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
    );
    expect(refinalize.status).toBe(409);
    expect(refinalize.data.code).toBe('ALREADY_LOCKED');

    const cloned = await apiJson<{ dossier: AiDiscloseDossier }>(
      `${srv.baseUrl}/api/dossiers/${encodeURIComponent(p1.data.dossier.id)}/duplicate`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
    );
    expect(cloned.status).toBe(201);
    expect(cloned.data.dossier.status).toBe('draft');
    expect(cloned.data.dossier.dossierNumber).toBe('');
    expect(cloned.data.dossier.organization.legalName).toContain('(Copy)');
  });

  it('exports Art. 50 HTML, Art. 4 Markdown, UTF-8 BOM CSV, executive summary, public report views & BASE_PATH assets', async () => {
    const srv = await startTestServer({ basePath: '/aidisclose', withFakeDist: true });

    const created = await apiJson<{ dossier: AiDiscloseDossier }>(
      `${srv.baseUrl}/aidisclose/api/dossiers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId: 'saas-copilot-compliant' }),
      },
    );
    const id = created.data.dossier.id;
    const slug = created.data.dossier.slug ?? '';
    expect(slug).toBe('saas-copilot-compliant');

    const art50Res = await fetch(`${srv.baseUrl}/aidisclose/api/dossiers/${encodeURIComponent(id)}/article50.html?locale=ar`);
    expect(art50Res.status).toBe(200);
    const art50Text = await art50Res.text();
    expect(art50Text).toContain('eu-ai-act-disclosure');
    expect(art50Text).toContain('application/ld+json');

    const mdRes = await fetch(`${srv.baseUrl}/aidisclose/api/dossiers/${encodeURIComponent(id)}/literacy.md?locale=en`);
    expect(mdRes.status).toBe(200);
    const mdText = await mdRes.text();
    expect(mdText).toContain('NOT legal counsel');
    expect(mdText).toContain('Article 4 AI Literacy');

    const csvRes = await fetch(`${srv.baseUrl}/aidisclose/api/dossiers/${encodeURIComponent(id)}/export.csv?locale=ar`);
    expect(csvRes.status).toBe(200);
    const csvBuf = Buffer.from(await csvRes.arrayBuffer());
    expect(Array.from(csvBuf.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const csvText = csvBuf.toString('utf8');
    expect(csvText.startsWith('\uFEFF')).toBe(true);
    expect(csvText).toContain('FEAT-CHAT-01');

    const sumRes = await apiJson<{ locale: string; summary: string }>(
      `${srv.baseUrl}/aidisclose/api/dossiers/${encodeURIComponent(id)}/summary?locale=ar`,
    );
    expect(sumRes.status).toBe(200);
    expect(sumRes.data.locale).toBe('ar');
    expect(sumRes.data.summary).toContain('ClearDesk Cloud B.V.');

    const pub1 = await apiJson<{
      viewCount: number;
      article50HtmlEn: string;
      article50HtmlAr: string;
      literacyMarkdownEn: string;
      literacyMarkdownAr: string;
      summaryEn: string;
      summaryAr: string;
    }>(`${srv.baseUrl}/aidisclose/api/public/reports/${encodeURIComponent(slug)}`);
    expect(pub1.status).toBe(200);
    expect(pub1.data.viewCount).toBe(1);
    expect(pub1.data.article50HtmlEn).toContain('application/ld+json');
    expect(pub1.data.literacyMarkdownAr).toContain('المادة 4');

    const pub2 = await apiJson<{ viewCount: number }>(
      `${srv.baseUrl}/aidisclose/api/public/reports/${encodeURIComponent(slug)}`,
    );
    expect(pub2.data.viewCount).toBe(2);

    const healthBase = await apiJson<{ basePath: string }>(`${srv.baseUrl}/aidisclose/api/health`);
    expect(healthBase.status).toBe(200);
    expect(healthBase.data.basePath).toBe('/aidisclose');

    const htmlRes = await fetch(`${srv.baseUrl}/aidisclose/`);
    expect(htmlRes.status).toBe(200);
    const html = await htmlRes.text();
    expect(html).toContain('window.__AIDISCLOSE_BASE__="/aidisclose"');
    expect(html).toContain('href="/aidisclose/assets/app.css"');
    expect(html).toContain('src="/aidisclose/assets/app.js"');
  });
});
