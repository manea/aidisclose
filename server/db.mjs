import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex');
}

function makeError(message, code, statusCode) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

export function slugify(input, fallback = 'dossier') {
  const cleaned = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function parseJsonSafe(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function openAiDiscloseDatabase(dataDir) {
  const resolvedDataDir = path.resolve(dataDir);
  fs.mkdirSync(resolvedDataDir, { recursive: true });

  const dbPath = path.join(resolvedDataDir, 'aidisclose.sqlite');
  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS dossiers (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      dossier_number TEXT UNIQUE,
      status TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      dossier_json TEXT NOT NULL,
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dossiers_status ON dossiers(status);
    CREATE INDEX IF NOT EXISTS idx_dossiers_updated ON dossiers(updated_at DESC);

    CREATE TABLE IF NOT EXISTS org_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      profile_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_org_profiles_updated ON org_profiles(updated_at DESC);

    CREATE TABLE IF NOT EXISTS dossier_counters (
      year INTEGER PRIMARY KEY,
      last_seq INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS dossier_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dossier_id TEXT NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      meta_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dossier_events ON dossier_events(dossier_id, id DESC);
  `);

  function ensureUniqueSlug(desiredSlug, excludeId = null) {
    const base = slugify(desiredSlug, 'dossier');
    let candidate = base;
    let suffix = 2;
    const checkStmt = db.prepare('SELECT id FROM dossiers WHERE slug = ?');
    while (true) {
      const existing = checkStmt.get(candidate);
      if (!existing || (excludeId && existing.id === excludeId)) {
        return candidate;
      }
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }

  function insertEvent(dossierId, eventType, actor, meta = {}, createdAt = new Date().toISOString()) {
    db.prepare(
      'INSERT INTO dossier_events (dossier_id, event_type, actor, meta_json, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(dossierId, eventType, actor, JSON.stringify(meta), createdAt);
  }

  function findDossierRowByKey(key) {
    return db
      .prepare('SELECT * FROM dossiers WHERE id = ? OR slug = ? OR dossier_number = ?')
      .get(key, key, key);
  }

  function hydrateBundle(row) {
    if (!row) return null;
    const dossier = parseJsonSafe(row.dossier_json, null);
    if (!dossier) return null;

    const events = db
      .prepare(
        'SELECT id, dossier_id, event_type, actor, meta_json, created_at FROM dossier_events WHERE dossier_id = ? ORDER BY id DESC LIMIT 30',
      )
      .all(dossier.id)
      .map((ev) => ({
        id: ev.id,
        dossierId: ev.dossier_id,
        eventType: ev.event_type,
        actor: ev.actor,
        meta: parseJsonSafe(ev.meta_json, {}),
        createdAt: ev.created_at,
      }));

    return {
      dossier,
      viewCount: Number(row.view_count || 0),
      dossierEvents: events,
    };
  }

  function getStats() {
    const totalRow = db.prepare('SELECT COUNT(*) AS cnt FROM dossiers').get();
    const byStatusRows = db.prepare('SELECT status, COUNT(*) AS cnt FROM dossiers GROUP BY status').all();
    const profRow = db.prepare('SELECT COUNT(*) AS cnt FROM org_profiles').get();
    let draftDossiers = 0;
    let lockedDossiers = 0;
    for (const row of byStatusRows) {
      if (row.status === 'draft') draftDossiers = Number(row.cnt || 0);
      if (row.status === 'locked') lockedDossiers = Number(row.cnt || 0);
    }
    return {
      totalDossiers: Number(totalRow?.cnt || 0),
      draftDossiers,
      lockedDossiers,
      orgProfilesCount: Number(profRow?.cnt || 0),
    };
  }

  function listDossiers() {
    const rows = db
      .prepare(
        'SELECT id, slug, dossier_number, status, operator_role, dossier_json, view_count, created_at, updated_at FROM dossiers ORDER BY updated_at DESC',
      )
      .all();

    return rows
      .map((row) => {
        const dossier = parseJsonSafe(row.dossier_json, null);
        if (!dossier) return null;
        return {
          id: row.id,
          slug: row.slug,
          dossierNumber: row.dossier_number ?? (dossier.dossierNumber || null),
          status: row.status,
          operatorRole: row.operator_role,
          viewCount: Number(row.view_count || 0),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          dossier,
        };
      })
      .filter((entry) => entry !== null);
  }

  function getDossierById(id) {
    const row = db.prepare('SELECT * FROM dossiers WHERE id = ?').get(id);
    return hydrateBundle(row);
  }

  function getDossierBySlugOrNumber(slugOrNumber, { incrementView = false } = {}) {
    const row = db
      .prepare('SELECT * FROM dossiers WHERE slug = ? OR dossier_number = ?')
      .get(slugOrNumber, slugOrNumber);
    if (!row) return null;
    if (incrementView) {
      db.prepare('UPDATE dossiers SET view_count = view_count + 1 WHERE id = ?').run(row.id);
      return getDossierById(row.id);
    }
    return hydrateBundle(row);
  }

  function createDossier(dossierInput, actor = 'governance') {
    const now = dossierInput.createdAt || new Date().toISOString();
    const id = dossierInput.id || `aid-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const uniqueSlug = ensureUniqueSlug(
      dossierInput.slug || dossierInput.organization?.legalName || id,
      id,
    );
    const operatorRole = dossierInput.organization?.operatorRole || 'deployer';
    const dossier = {
      ...dossierInput,
      id,
      slug: uniqueSlug,
      status: 'draft',
      dossierNumber: '',
      scopeDigestHex: '',
      lockedAt: undefined,
      createdAt: now,
      updatedAt: dossierInput.updatedAt || now,
    };

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        `INSERT INTO dossiers
         (id, slug, dossier_number, status, operator_role, dossier_json, view_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      ).run(
        dossier.id,
        dossier.slug,
        null,
        dossier.status,
        operatorRole,
        JSON.stringify(dossier),
        dossier.createdAt,
        dossier.updatedAt,
      );

      insertEvent(
        dossier.id,
        'DOSSIER_CREATED',
        actor,
        {
          slug: dossier.slug,
          operatorRole,
          disclosureScore: dossier.auditReport?.disclosureScore ?? 0,
          overallScore: dossier.readinessSummary?.overallScore ?? 0,
        },
        now,
      );
      db.exec('COMMIT');
      return getDossierById(dossier.id);
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  function updateDossier(id, mutatorFn, actor = 'governance', eventType = 'DOSSIER_UPDATED') {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = findDossierRowByKey(id);
      if (!row) {
        db.exec('ROLLBACK');
        return null;
      }
      const current = parseJsonSafe(row.dossier_json, null);
      if (!current) {
        db.exec('ROLLBACK');
        return null;
      }
      if (current.status === 'locked' || row.status === 'locked') {
        throw makeError(
          'Finalized EU AI Act readiness dossier is sealed against mutation.',
          'DOSSIER_LOCKED',
          409,
        );
      }

      const next = mutatorFn(current);
      if (!next) {
        db.exec('ROLLBACK');
        return null;
      }

      const uniqueSlug = ensureUniqueSlug(next.slug || current.slug, current.id);
      const now = new Date().toISOString();
      const operatorRole = next.organization?.operatorRole || current.organization?.operatorRole || 'deployer';
      const updated = {
        ...next,
        id: current.id,
        slug: uniqueSlug,
        status: 'draft',
        dossierNumber: '',
        scopeDigestHex: '',
        lockedAt: undefined,
        createdAt: current.createdAt,
        updatedAt: now,
      };

      db.prepare('UPDATE dossiers SET slug = ?, operator_role = ?, dossier_json = ?, updated_at = ? WHERE id = ?').run(
        updated.slug,
        operatorRole,
        JSON.stringify(updated),
        updated.updatedAt,
        current.id,
      );

      insertEvent(
        current.id,
        eventType,
        actor,
        {
          disclosureScore: updated.auditReport?.disclosureScore ?? 0,
          overallScore: updated.readinessSummary?.overallScore ?? 0,
        },
        now,
      );
      db.exec('COMMIT');
      return getDossierById(current.id);
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  function deleteDossier(id) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = findDossierRowByKey(id);
      if (!row) {
        db.exec('ROLLBACK');
        return { deleted: false };
      }
      if (row.status === 'locked') {
        throw makeError(
          'Locked EU AI Act dossier cannot be deleted; duplicate it into a new editable draft instead.',
          'DOSSIER_LOCKED',
          409,
        );
      }
      db.prepare('DELETE FROM dossiers WHERE id = ?').run(row.id);
      db.exec('COMMIT');
      return { deleted: true, id: row.id };
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  function duplicateDossier(id, actor = 'governance') {
    const sourceBundle = getDossierById(id) || getDossierBySlugOrNumber(id);
    if (!sourceBundle) return null;
    const src = sourceBundle.dossier;
    const now = new Date().toISOString();
    const suffix = crypto.randomBytes(2).toString('hex');
    const newId = `aid-${Date.now().toString(36)}-${suffix}`;
    const cloned = {
      ...src,
      id: newId,
      slug: `${slugify(src.slug || src.organization?.legalName, 'dossier')}-copy-${suffix}`,
      dossierNumber: '',
      scopeDigestHex: '',
      lockedAt: undefined,
      organization: {
        ...src.organization,
        legalName: `${src.organization.legalName} (Copy)`,
      },
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    return createDossier(cloned, actor);
  }

  function finalizeDossier(id, buildCanonicalTextFn, actor = 'governance') {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = findDossierRowByKey(id);
      if (!row) {
        db.exec('ROLLBACK');
        return null;
      }
      const current = parseJsonSafe(row.dossier_json, null);
      if (!current) {
        db.exec('ROLLBACK');
        return null;
      }
      if (current.status === 'locked' || row.status === 'locked') {
        throw makeError('EU AI Act readiness dossier is already finalized.', 'ALREADY_LOCKED', 409);
      }

      const now = new Date().toISOString();
      const year = new Date().getUTCFullYear();
      db.prepare(
        'INSERT INTO dossier_counters (year, last_seq) VALUES (?, 1) ON CONFLICT(year) DO UPDATE SET last_seq = last_seq + 1',
      ).run(year);
      const seqRow = db.prepare('SELECT last_seq FROM dossier_counters WHERE year = ?').get(year);
      const seq = Number(seqRow?.last_seq || 1);
      const dossierNumber = `AID-${year}-${String(seq).padStart(4, '0')}`;

      const preDigestDossier = {
        ...current,
        dossierNumber,
      };
      const canonical = buildCanonicalTextFn(preDigestDossier);
      const scopeDigestHex = sha256Hex(canonical);

      const lockedDossier = {
        ...preDigestDossier,
        scopeDigestHex,
        status: 'locked',
        lockedAt: now,
        updatedAt: now,
      };

      db.prepare(
        'UPDATE dossiers SET dossier_number = ?, status = ?, dossier_json = ?, updated_at = ? WHERE id = ?',
      ).run(dossierNumber, 'locked', JSON.stringify(lockedDossier), now, current.id);

      insertEvent(current.id, 'DOSSIER_FINALIZED', actor, { dossierNumber, scopeDigestHex }, now);

      db.exec('COMMIT');
      return getDossierById(current.id);
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  function normalizeProfileFields(input, fallback = {}) {
    const rawRole = String(input?.operatorRole ?? fallback.operatorRole ?? 'deployer')
      .trim()
      .toLowerCase();
    const operatorRole =
      rawRole === 'provider' || rawRole === 'deployer' || rawRole === 'both'
        ? rawRole
        : 'deployer';
    const legalName = String(
      input?.legalName ?? input?.name ?? fallback.legalName ?? 'AI Operator Organization',
    ).trim();
    return {
      legalName,
      contactEmail: String(
        input?.contactEmail ?? fallback.contactEmail ?? 'ai-governance@example.eu',
      ).trim(),
      countryCode: String(input?.countryCode ?? fallback.countryCode ?? 'DE')
        .trim()
        .toUpperCase(),
      operatorRole,
      dpoOrGovLead: String(
        input?.dpoOrGovLead ?? fallback.dpoOrGovLead ?? 'AI Governance Lead',
      ).trim(),
      ...(input?.governancePolicyUrl !== undefined
        ? { governancePolicyUrl: String(input.governancePolicyUrl || '').trim() }
        : fallback.governancePolicyUrl
          ? { governancePolicyUrl: fallback.governancePolicyUrl }
          : {}),
    };
  }

  function listProfiles() {
    return db
      .prepare('SELECT id, name, profile_json, created_at, updated_at FROM org_profiles ORDER BY updated_at DESC')
      .all()
      .map((row) => ({
        id: row.id,
        name: row.name,
        profile: parseJsonSafe(row.profile_json, {}),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  }

  function createProfile(profileInput) {
    const now = new Date().toISOString();
    const id = profileInput.id || `org-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    const profileObj = normalizeProfileFields(profileInput);
    const name = String(profileInput.name || profileObj.legalName).trim();

    db.prepare(
      'INSERT INTO org_profiles (id, name, profile_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).run(id, name, JSON.stringify(profileObj), now, now);

    const saved = db.prepare('SELECT * FROM org_profiles WHERE id = ?').get(id);
    return {
      id: saved.id,
      name: saved.name,
      profile: parseJsonSafe(saved.profile_json, {}),
      createdAt: saved.created_at,
      updatedAt: saved.updated_at,
    };
  }

  function updateProfile(id, patch) {
    const row = db.prepare('SELECT * FROM org_profiles WHERE id = ?').get(id);
    if (!row) return null;
    const prev = parseJsonSafe(row.profile_json, {});
    const now = new Date().toISOString();
    const nextProfile = normalizeProfileFields(patch || {}, { ...prev, legalName: prev.legalName || row.name });
    const nextName = patch?.name !== undefined ? String(patch.name).trim() || row.name : nextProfile.legalName;

    db.prepare('UPDATE org_profiles SET name = ?, profile_json = ?, updated_at = ? WHERE id = ?').run(
      nextName,
      JSON.stringify(nextProfile),
      now,
      id,
    );

    const updated = db.prepare('SELECT * FROM org_profiles WHERE id = ?').get(id);
    return {
      id: updated.id,
      name: updated.name,
      profile: parseJsonSafe(updated.profile_json, {}),
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  }

  function deleteProfile(id) {
    const info = db.prepare('DELETE FROM org_profiles WHERE id = ?').run(id);
    return { deleted: Number(info.changes || 0) > 0 };
  }

  return {
    sha256Hex,
    getStats,
    listDossiers,
    getDossierById,
    getDossierBySlugOrNumber,
    createDossier,
    updateDossier,
    deleteDossier,
    duplicateDossier,
    finalizeDossier,
    listProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    close: () => db.close(),
  };
}
