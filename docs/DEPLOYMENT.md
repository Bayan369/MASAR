# MASAR deployment guide

This is an operator runbook, **not a record of a deployment already performed**. No hosted schema/data/infrastructure was changed during implementation. Local tests cannot prove your hosted Auth/Storage/model/network configuration works. Finish the live acceptance gate before release.

## 1. Select hosting and private configuration

You need a static frontend host (or the included Nginx container), an HTTPS FastAPI service, and a **long-running worker process**. A request-only/serverless frontend host alone cannot run the worker. Use the existing Supabase PostgreSQL/Auth/Storage project and Workers Free account. Do not add another database/vector service. Keep public internet access restrictions; allow outbound HTTPS only to the selected Supabase hostname and `api.cloudflare.com`, plus package registries during builds. This managed session currently lacks the Cloudflare host rule; no rule was changed.

Choose final frontend/API URLs. Terminate TLS using your host or reverse proxy. Set trusted forwarding/IP limits at that proxy; do not trust arbitrary client forwarded headers. Backend CORS must list **exact frontend origins**, not paths or wildcards. Configure a 6MiB proxy request-body limit, at least 180-second assistant request timeout and a reasonable global concurrent-connection/rate limit. API application-level questions are limited to 30/user/minute per process; provider calls are serialized per process. Start with one API process and one worker.

Copy templates **without overwriting existing private files**:

```sh
cpdeploy/backend.env.example backend/.env
cpdeploy/frontend.env.example frontend/.env
```

Use your hosting secret manager in production instead of committed files. `backend/.env` is server-only; never pass it as frontend build input. Never paste secrets into shell commands, chat, CI logs, support screenshots or Git. Fill:

| Variable | Required value / scope |
| --- | --- |
| `VITE_API_BASE_URL` | Public HTTPS backend origin, no `/api/v1` suffix; **build-time** |
| `VITE_SUPABASE_URL` | Public project base HTTPS URL; **build-time** |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public `sb_publishable_…` key; **build-time**, never secret/service-role |
| `MASAR_ENVIRONMENT` | `production` (startup fails on incomplete mandatory integration settings) |
| `MASAR_APP_NAME` | `MASAR` |
| `MASAR_CORS_ORIGINS` | JSON array such as `["https://masar.example.com"]` |
| `MASAR_AUTH_REDIRECT_URL` | Exact `https://masar.example.com/reset-password` |
| `MASAR_SUPABASE_URL` | Same project's base HTTPS URL |
| `MASAR_SUPABASE_PUBLISHABLE_KEY` | Same public publishable key |
| `MASAR_SUPABASE_SERVICE_KEY` | **Secret, API/worker only**, Supabase secret key or legacy service-role JWT |
| `MASAR_CLOUDFLARE_ACCOUNT_ID` | Account identifier, server only |
| `MASAR_CLOUDFLARE_API_TOKEN` | **Secret, API/worker only**, account-scoped Workers AI inference permission |
| `MASAR_CLOUDFLARE_MODEL` | `@cf/meta/llama-3.1-8b-instruct-fp8-fast` |
| `MASAR_CLOUDFLARE_FREE_PLAN_CONFIRMED` | `true` only after verifying Workers Free remains active |
| `MASAR_AI_CALL_BUDGET` | Conservative `20`; allowed 1–500; shared chat/embedding attempts **per process** |
| `MASAR_RETRIEVAL_MODE` | `hybrid` for multilingual BGE-M3/lexical retrieval |
| `MASAR_DEMO_ENABLED` | `false`; production refuses demo mode |

Optional `MASAR_MAX_UPLOAD_BYTES` may lower the 5MiB limit; it cannot increase it. Defaults need no additional configuration.

Frontend build inputs are public and embedded in JS; changing them requires rebuilding/redeploying. Production backend validates configuration at startup without printing input values. Production does not expose interactive `/docs`; health is liveness, not proof of dependency readiness.

## 2. Review and apply migrations — explicit operator action

**Do not run these commands until you approve modifying the target database and have a backup.** This development task did not run them.

1. Inspect hosted PostgreSQL version, existing tables/policies/bucket and `supabase_migrations` history. The app targets PostgreSQL 17 and pgvector 0.8.1. If existing objects conflict or vector lives outside `extensions`, stop and reconcile a reviewed migration; do not reset/drop hosted data.
2. Keep `private` outside exposed API schemas. Default exposed `public` is required. Never grant browser roles access to trusted RPCs.
3. Review all five files under `supabase/migrations` in order. The first two are preserved Foundation; remaining three add product operations, private Storage and management. Each migration is transactional; a failure blocks rollout. No `seed.sql` is used.
4. Install Supabase CLI via its official package/binary, authenticate privately, then from the repo root:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
# Only after backup, dry-run review and explicit approval:
supabase db push
```

Do not commit generated link/cache files. Never run `db reset` against a remote URL. Do not use the local SQL test harness on a hosted DB. Migration 4 creates private `company-documents` with 5MiB and PDF/DOCX/TXT MIME constraints. It refuses an existing public bucket rather than silently exposing originals. Verify dashboard bucket privacy/policies afterward; existing deployments require reconciling any preexisting policies.

## 3. Configure Auth and bootstrap access

In Supabase Auth:

- Enable email/password sign-in and invite/recovery delivery; configure production SMTP/domain/limits and email templates through your existing approved account. If SMTP requires spending, choose an existing/free approved option; do not enable paid billing implicitly.
- Disable public signup (there is no public company signup flow). Set Site URL to the frontend and allow the **exact** `/reset-password` redirect for deployment/local testing.
- Use a confirmed/invited real administrator Auth user. Copy its UUID privately; no default admin/password exists.
- Set minimum password length >=12 and appropriate Auth rate limits. MASAR recovery UI enforces 12; login accepts existing provider-approved passwords.

After migrations and credentials, explicitly provision that existing Auth identity:

```sh
cd backend
uv run python -m scripts.bootstrap_company --admin-user-id AUTH_USER_UUID --company-name 'YOUR COMPANY' --display-name 'ADMIN DISPLAY NAME' --confirm-provision
```

Or run `python -m scripts.bootstrap_company ...` inside the API container. This creates one company and administrator profile; it refuses an existing membership. It was **not** executed against your hosted project. Thereafter admins invite users from settings, choosing a role and optional department. Invitation redirect goes to the configured password setup page. Auth invitation and membership creation are two external operations; an interruption after email delivery may leave an Auth user without a profile. That user is fail-closed. An operator can use service-only `provision_member` with the verified admin/user UUID to finish the membership after reviewing the incident; never grant a role from email domain or user metadata. Existing users from another company cannot be reassigned by invite.

## 4. Configure Workers AI

Use Workers **Free**, not Paid. Grant your account-scoped token the required Workers AI inference permission. Check model availability for Llama `@cf/meta/llama-3.1-8b-instruct-fp8-fast` and multilingual embeddings `@cf/baai/bge-m3` (1024 dimensions). No model/plan/token configuration or inference request was performed for your account in this implementation.

The client accepts bounded non-streaming JSON, validates embedding dimensions/finite numbers, exact evidence IDs/excerpts and answer numeric evidence. Network/auth/quota failures halt further provider calls. No automatic retries or paid fallback. A worker exits on provider failure; `restart: "no"` prevents unattended repeated usage. Review the safe code/provider dashboard before retrying a failed document and manually restarting. The local attempt budget is not an account-wide daily neurons meter; Free-plan enforcement is the account-level boundary. Do not enable paid usage.

## 5. Build and run

### Separate hosting services

Frontend:

```sh
cd frontend
npm ci
npm run build
```

Serve `dist/` with SPA fallback to `index.html`, immutable hashed assets, no-store HTML and security headers (see `frontend/nginx.conf`). The included CSP allows HTTPS API connections; tighten `connect-src` to your two exact service origins at your reverse proxy when choosing hosting.

Backend:

```sh
cd backend
uv sync --frozen --no-dev
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log --limit-concurrency 16 --timeout-keep-alive 5
# Separate persistent worker, same private environment:
uv run python -m app.worker
```

Start worker only once migrations/storage/credentials/Free/network are ready. No table creation happens at API/worker startup.

### Containers / Compose

`backend/Dockerfile`: locked Python dependencies, non-root, same image for API and worker, no private `.env` in context. `frontend/Dockerfile`: Node build plus non-root Nginx static runtime; only three public build args. `compose.yaml` adds read-only filesystems, tmpfs, dropped capabilities, health checks and loopback bindings. It uses external Supabase; it does not create a DB or run migrations.

For local full-stack: copy root `.env.example` to root `.env` if absent, put the three **public** build inputs there, and configure `backend/.env` as development with localhost frontend/API URLs. Include `http://localhost:8080` in CORS and use `MASAR_AUTH_REDIRECT_URL=http://localhost:8080/reset-password` plus the matching Supabase allowed redirect.

```sh
docker compose build
docker compose up -d api web
# Start worker after approved external setup:
docker compose up -d worker
docker compose ps
```

Open `http://localhost:8080`. For production keep containers private behind your host's TLS proxy and set HTTPS URLs/origins; replace loopback publishing only through that hosting configuration. Never expose Docker or the worker. Never use automatic restart loops for the AI worker.

Managed Codex builds require preserved proxy/TLS trust. Pass the platform's CA as BuildKit secret `proxy_ca` to both builds; Dockerfiles use it only for networked package installation. Do not disable TLS or copy a session certificate into an image. Runtime HTTPS behind that proxy requires a read-only CA bundle mount and client trust environment configured by the platform. Standard hosting with normal public roots requires no session-specific override.

The prepared GitHub quality workflow is manual (`workflow_dispatch`) and was not executed on GitHub during this task. It does not deploy or run automatically on push. Run locally or enable manually within your existing free Actions allowance.

## 6. Acceptance before public release

Run all commands in README, then the live procedure in `docs/VALIDATION.md` with real approved documents and a test employee/admin in two distinct companies. Confirm login/recovery/logout, department/role restrictions, original private download, both language questions, exact sources, no-result behavior, history privacy/revocation and worker error/retry. Stop on any provider/quota failure. Do not retry to hide a failed test.

## Operations and security

- API health: `GET /api/v1/health` (liveness only). Monitor actual error codes, document queue age/status, worker process exit and provider Free usage. The worker has no independent HTTP listener; monitor it as a process/job service.
- Data: documents/private originals and conversation text remain sensitive; prevent request-body/Authorization logging at proxies/APM. Application logs show safe categories/codes, not prompts, generated text, tokens or upstream bodies. Disable access logging on signed downloads at the hosting proxy.
- Backups: enable existing approved Supabase backup/export procedures and separately back up private Storage. Verify restoration in an isolated project before real rollout; no backup/restore test was run against your hosted data. Never assume DB backup includes Storage bytes.
- Permissions: active profile changes take effect on the next backend/DB call. Admins cannot see other people's private conversations. Existing signed file URLs remain usable until their 60-second expiry after revocation; do not cache them. History hides revoked answers.
- Limits: 5MiB originals, <=100 PDF pages, <=100k characters, <=80 chunks; no OCR. PDF/DOCX parsers run in a bounded subprocess with no inherited secrets, CPU/memory/wall-time limits. DOCX archives are never extracted onto disk. Original uploads can contain harmful content; treat downloads as untrusted and use your existing endpoint protection.
- Scaling: 500 departments/documents/members, latest100 conversations and latest500 messages per thread are bounded list windows, not analytics totals. Archive/remove obsolete data or add reviewed pagination before exceeding these initial limits. One active company/department per identity. No cross-company moves, open signup, custom SSO, malware-scanning service, OCR or legal retention policy is assumed.
- Grounding: exact cited evidence and numeric claims are checked; semantic correctness of every generated paraphrase cannot be mathematically guaranteed. Review real Arabic/English relevance and answers on your approved documents before release. The model sees only permitted retrieved text; treat document instructions as untrusted.
- Rollout/rollback: back up before migrations; preserve the previously deployed images/builds. Roll back app images if necessary, but do not drop schema/data to roll back an app. Reconcile migrations through a reviewed forward migration. Rotate exposed secrets immediately through the provider, never through a frontend build.
