# AIDisclose — $0 Deployment & Ethical Launch Guide

## 1. Zero-Budget Deployment Options (`$0/month`)

### Path A: Cloudflare Workers Static Assets (Recommended Static `$0` Hosting)
- Commercially safe `$0` static hosting configured via `wrangler.jsonc` (`./dist`, SPA routing).
- All Article 4 AI literacy checks, Article 50 transparency checks, bulk CSV inventory auditing, HTML + JSON-LD generation, SHA-256 sealing, and A4 PDF printing run 100% locally in the browser (`localStorage` persistence).

```bash
npm run build
npx wrangler login
npx wrangler deploy
```

### Path B: Self-Hosted Node 22 + SQLite WAL (`Docker` / `systemd`)
1. **Docker Compose** (`127.0.0.1:4197`):
   ```bash
   docker compose up -d --build
   ```
   Reverse proxy via `deploy/Caddyfile`.
2. **Systemd + Online SQLite Backups**:
   - Template unit: `deploy/aidisclose.service`
   - Online `VACUUM INTO` 14-day backup script: `deploy/backup-sqlite.sh`

---

## 2. Ethical Organic Distribution Drafts (`$0` Marketing)

- **Target Communities**:
  - SaaS founders, AI product teams, digital publishers, and European SME compliance leads preparing for **Article 4 (`2025-02-02`)** and **Article 50 (`2026-08-02`)** under **Regulation (EU) 2024/1689**.
  - Open-source AI governance builders on GitHub (`eu-ai-act`, `article-50`, `article-4`, `ai-literacy`, `ai-transparency`, `c2pa`, `json-ld`, `regulation-2024-1689`).
- **Positioning & Legal Accuracy Guardrail**:
  - Always state clearly that AIDisclose runs locally in the browser with zero SaaS vendor lock-in and does **not** serve as legal counsel or an EU AI Act Notified Body, does **not** certify `Annex III` high-risk conformity, and does **not** inject cryptographic `C2PA` provenances inside binary media files.
