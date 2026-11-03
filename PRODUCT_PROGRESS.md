# MASAR production completion — 2026-11-02

Statuses: [ ] not started; [~] in progress; [x] verified complete; [!] externally blocked.

Scope: complete/test the product locally, prepare deployment, commit/push the feature branch. Never hosted SQL/data changes, actual deployment, main merge, paid services or secrets publication. Existing Foundation is preserved and extended with additive migrations. **Verified local implementation is distinct from live external acceptance.**

- [x] Inspect the repository, complete request and unfinished/demo-only paths; document decisions.
- [x] Preserve seven-table Foundation and add trusted operations, queue leases, Storage policies, hybrid retrieval, private atomic turns and admin controls — five migrations applied only in disposable local PostgreSQL.
- [x] Verify tenant/role/storage/citation/ownership/revocation controls — 81 Foundation +35 product SQL assertions passed; every fixture rolled back, all seven tables empty, container removed.
- [x] Implement verified Supabase bearer identity and database-derived active company/role; protect backend endpoints and frontend routes; no self privilege changes.
- [x] Implement company/departments/membership administration, private upload/download, ACL editing, duplicate protection, bounded PDF/DOCX/TXT extraction, durable worker, failure/retry/archive/delete.
- [x] Implement tenant RAG with BGE-M3 1024-dimensional embeddings, pgvector/lexical retrieval, Llama exact evidence IDs/excerpts; no demo fallback, fabricated sources or paid retry path. Provider protocol tested offline; actual service acceptance remains blocked below.
- [x] Implement private persistent conversation turns, request UUID replay protection, owner-only history/rename/delete, source revocation and deterministic question-before-answer ordering.
- [x] Complete Arabic-first employee/admin UI, real profile/company data, login/recovery/logout/session errors, responsive screens, actual source deep links and useful loading/empty/error/success states.
- [x] Verify backend — **127 pytest tests**, Ruff lint/format pass.
- [x] Verify frontend — **20 unit tests**, TypeScript/lint/Prettier/build pass; **24 Chromium browser checks** across desktop/mobile/tablet, including Axe WCAG checks, settled empty states and deep source navigation.
- [x] Inspect actual rendered desktop/mobile UI with clearly labeled offline browser fixtures; fix empty-notice contrast and settings alignment.
- [x] Resolve dependency audit advisories — patched Vitest/ESLint and API-compatible minimatch override; **npm audit: zero vulnerabilities**, including development tooling.
- [x] Prepare and build API/web production Docker images; verify non-root/read-only/network-isolated health, SPA routes, anonymous API denial and worker fail-closed behavior. Correct image ownership and localhost health probes. Remove smoke containers.
- [x] Validate Compose/TOML; add private/public environment templates, manual CI workflow, deployment/operations/backup/migration/Auth/Free-account/live-acceptance instructions. CI itself not executed on GitHub.
- [x] Commit and push backend/database milestone — `d4bed63`, feature branch only.
- [x] Commit and push authenticated UI/source/security milestone — `945b9aa`; local and tracking ref equality verified.
- [x] Publish tested release packaging/documentation — `5db9a4afa4506640d8190c5d72168431e246777f`; live GitHub `ls-remote` equals local release HEAD, working tree clean and both private .env paths untracked. Final documentation verification record follows on the same branch.
- [!] Real Supabase Auth/Storage/RLS gateway and Cloudflare embeddings/inference acceptance: credentials are unset; Cloudflare hostname not in current runtime allowlist; hosted SQL/data writes/deployment prohibited. Owner must complete approved external setup and permit the live acceptance procedure. No live success claimed.
- [!] Hosted backup/restore drill and production rollout: require selected hosting, approved Supabase/Storage backup configuration and isolated restore destination; not performed against hosted data.

Environment restart recovery: all source changes survived; orphaned local test servers were stopped and the final24 browser tests, image builds/smoke and127 backend tests were rerun successfully. The restricted environment/network configuration was not changed. No secret `.env` file was committed or included in images.

Evidence: docs/VALIDATION.md. Setup/deployment: docs/DEPLOYMENT.md. Architecture/security: docs/DATABASE_FOUNDATION.md and docs/PRODUCT_DECISIONS.md. Original PHASE1_PROGRESS.md remains the historical foundation checklist; no development checklist is rendered in the employee UI.

## UTF-8 subprocess regression — 2026-11-03

- [x] Reproduce legacy stdout encoding corruption with a real subprocess under cp1252:replace; enforce explicit UTF-8 binary output/strict parent decoding and fixed child UTF-8 settings while retaining the environment allowlist and25-second timeout. Four regression cases verify Arabic/English preservation, secret isolation and invalid-encoding rejection.
- [x] Complete Backend suite: `UV_CACHE_DIR=/tmp/masar-encoding-uv uv run --frozen --extra dev pytest` —131 passed on Linux/Python3.12.14, including legacy Windows-style stream simulation. Ruff lint/format passed. No hosted SQL, Supabase operations, commits or pushes.

## One-hour demo preparation — 2026-11-03

- [x] Review current branch929171c, existing deployment/migrations/bootstrap/worker paths; initial tree clean.
- [x] Local readiness only:131 Backend tests pass and frontend production build passes. Credential presence checked without displaying values: required Supabase/Cloudflare fields unset; current Codex policy lacks Cloudflare hostname.
- [x] Prepare docs/DEMO_ONE_HOUR.md with timed approval gates and existing run commands; correct two malformed template-copy commands in DEPLOYMENT.md. No application changes.
- [!] Hosted schema/Auth/Storage/data writes and live inference await the owner's review/approval and private configuration. No users, hosted SQL, Supabase writes or environment policy changes performed.

## Approved demo execution — 2026-11-03

Owner approved pending-only hosted migrations, initial Auth admin/company bootstrap, demo document/chunks/conversation and Workers Free inference. No resets/deletion/deployment/main changes.

- [x] Confirm feat/phase-1-foundation at929171c; preserve preexisting local planning-doc changes.
- [x] Inspect local five migration files and existing bootstrap configuration. No Supabase CLI/psql or connected Supabase tool available; no remote schema/history inspection claimed.
- [x] Prepare docs/demo/masar-demo-guide.txt with explicitly labeled technical demo content derived from implemented application behavior, not invented company policies. Actual bounded extraction verifies one UTF-8 chunk locally.
- [!] Hosted schema/conflict inspection is blocked: required Supabase app credentials and migration/admin access absent; no configured secret bindings. Current network permits only the selected Supabase project domain, not api.cloudflare.com or the Supabase Management API domain. No hosted calls/writes, users or inference created/performed. Private configuration and any required network-management scope must be resolved first.
- [ ] After access is ready: inspect target identity/schema/extensions/migration history and conflicts read-only; stop on conflicts; apply missing migrations only.
- [ ] After schema gate: create/use the approved Auth Admin, run company bootstrap, upload/process demo TXT, ask a cited question and verify original source/history. No success marked without live evidence.

## Maximum local demo readiness — 2026-11-03

- [x] Reverified131 Backend tests and Ruff;20 frontend unit tests,24 browser contract tests, ESLint/Prettier/TypeScript and production build pass. Browser contracts are not live Auth/AI proof.
- [x] Fill only empty non-secret API/project URL settings in ignored backend/.env and frontend/.env; preserve existing values and never insert dummy credentials. No .env tracked.
- [x] Start actual local FastAPI and Vite services. Do not start the hosted-processing worker before schema/access gates.
- [x] Inspect official Studio extension/policy source and Management permission schemas. Confirm `database_read` works and `storage_read` is still denied403; do not treat OpenAPI as the database inventory.
- [x] Prepare catalog-only SELECT in docs/DEMO_PREFLIGHT_CATALOG_READ_ONLY.sql and least-privilege steps in docs/DEMO_ACCESS.md. Query has NOT been executed; earlier SQL prohibition remains respected.
- [!] Conflict/vector/RLS/bucket verification awaits `storage_read` plus explicit permission for catalog SELECTs through the read-only endpoint (database_read already available), or equivalent trusted Dashboard metadata.
- [!] After the conflict gate only, applying migrations requires `database_migrations_write`; no Full access requested and no write attempted with the read token.
- [!] Live login/upload/indexing/Llama test still requires private application keys/Cloudflare settings and the owner's Admin/company details; no fake integration or provider response substituted.
- [x] Actual unmocked local runtime check completed: frontend/login HTTP200, API health HTTP200, Arabic RTL rendered, zero external browser requests. Auth correctly reports missing configuration; no successful login/hosted AI claimed.

## End-to-end demo authorization and local hardening — 2026-11-03

- [x] Receive the owner's Admin/company inputs and preserve them only in ignored backend/.env; no login password generated and no hosted account created.
- [x] Verify current masar-dev ACTIVE_HEALTHY and empty migration history by authenticated GET; Storage listing remains403 missing storage_read. Treat the Management token as read-only; no write probe attempted.
- [x] Preserve the actual catalog preflight findings in docs/demo/catalog-preflight-summary.json. The earlier SQL-read-only gate was explicitly approved and completed; bucket privacy still unknown.
- [x] Remove DROP POLICY from the unapplied migration3 in favor of ALTER POLICY, preserving permissions/identity. No top-level DROP remains in the five migration files.
- [x] Add an actual policy-OID preservation check and exact official-image digest override to the local SQL runner; verify116 SQL assertions plus policy preservation on pgvector0.8.2/PostgreSQL17.10, with fixture rollback/container cleanup. No hosted schema/data changed.
- [x] Commit/push verified local demo preparation and non-destructive migration changes on feat/phase-1-foundation — 731dcda; successful origin push and clean tracking status verified.
- [!] Hosted foundation awaits storage_read to inspect bucket privacy and database_migrations_write to apply/record migrations after refreshed conflict checks. No Full access requested; no denied operation bypassed.
- [!] Actual Auth login/creation, upload/indexing/Llama/recovery acceptance awaits private Supabase app keys and Cloudflare account/token. App health200/local UI rendering and offline tests are not a successful live acceptance run.
- [x] Record interim acceptance honestly in docs/DEMO_LIVE_STATUS.md: Storage403, no hosted writes, runtime keys missing, no real Llama/Auth journey. Narrow permissions documented from official API metadata, not guessed.


## Explicitly authorized offline Mock Data conversation demo — 2026-11-03

This owner-requested demo is separate from the real integrations. Earlier live
acceptance blockers remain; offline demo success does not satisfy live Llama acceptance.

- [x] Inspect current feature branch and existing Auth/assistant paths; clean initial tree.
- [x] Add isolated `/demo` outside AuthProvider, preserving real routes; no credentials or Backend needed.
- [x] Add clearly fictional company/department/onboarding/leave/IT/VPN/communication knowledge and exact source excerpts.
- [x] Verify per-chat topic/step context, Arabic/English follow-ups, clarification, missing-fact refusal and source integrity with five unit tests.
- [x] Add Arabic RTL history, new-chat control, typing indicator, composer, source details and three confidence states; history is memory-only.
- [x] Desktop/mobile browser scenario: multi-turn discussion, source quote, unknown question, new-chat isolation and old-chat retrieval; zero external requests, no horizontal overflow and Axe checks pass (2 tests).
- [x] Final frontend rerun: 25 unit tests pass; lint/build/format pass; both offline browser scenarios pass after follow-up aliases.
- [ ] Commit/push offline demo changes (not performed in this task).
- [x] Existing workspace regression suite: 24 desktop/mobile/tablet browser checks passed; authenticated product routes preserved.
- [x] Full unchanged Backend regression suite: 131 tests pass with local TestClient socket access; no hosted operations.

- [x] Urgent demo entry: `/` and `/demo` both render outside AuthProvider; removed real-login link from demo sidebar. Verified actual running Vite on port5173: both routes HTTP200, no redirects or external requests. Repeated 25 unit tests, 2 offline browser checks, lint/build pass. No hosted changes.

## Published demo route correction — 2026-11-03

- [x] Identify cause: remote commit6db8945 lacks all uncommitted demo files; its wildcard route requires authentication.
- [x] Define `/` and `/demo` at the top-level router outside AuthProvider/RequireAuth. Include complete offline demo implementation, sources and tests in the release.
- [x] Verify actual production frontend build on port5175: 2 desktop/mobile acceptance tests pass, 25 unit tests pass, lint passes. Root and /demo render anonymously with zero external requests.


## Employee demo platform expansion — 2026-11-03

- [x] Inspect existing offline chat and preserve it within the same demo component; keep real-service code and database files untouched.
- [x] Add shared fictional department catalog, seven department details, and department source documents; reserved .invalid contacts only.
- [x] Add home/company introduction, onboarding guide, policy procedures, document list/detail and dedicated MASAR AI navigation under /demo; no auth or external APIs.
- [x] Link assistant evidence to original document pages and mentioned departments; preserve per-chat state across client-side platform navigation.
- [x] Verify 27 unit tests, ESLint, TypeScript/production build and Prettier.
- [x] Verify all 29 valid direct/deep routes plus 4 missing-page cases, cross-page source links, chat context after navigation and desktop/mobile accessibility/overflow on actual production frontend: all 4 browser scenarios pass; zero external requests/page errors.
- [x] Publish verified feature implementation 772f759 to origin/feat/phase-1-foundation; live remote hash verified equal and working tree clean. No main merge, hosted SQL or public deployment.

## Direct-entry platform UI/UX refinement — 2026-11-03

- [x] Remove authentication entry from the active frontend router; root renders Home without redirect, login/recovery URLs return Home and legacy /demo links resolve to canonical platform routes.
- [x] Remove demo/disclaimer wording from rendered shell, content, sources and chat states; preserve source integrity, uncertain/unknown answers and all 7 departments/13 documents.
- [x] Refine shared RTL design tokens, sidebar/topbar/mobile menu, Home composition, department details, searchable directory, policy guides, searchable/filterable documents, reading layout and conversation history/composer. Desktop visual review completed; keyboard/empty/focus states implemented.
- [x] Verify all 29 canonical pages and 29 old /demo aliases, login/recovery redirects, source links, missing pages, search/filter/empty states, context after navigation and keyboard controls. All 12 desktop/tablet/mobile browser scenarios pass; zero external requests, page errors, retired visible copy or horizontal overflow. Axe checks pass after contrast/mobile-landmark fixes.
- [x] Unit suite: 28 pass; all 12 active browser scenarios, production build, ESLint and Prettier pass. Actual screenshots reviewed for Home, department detail, document list, onboarding and conversation on desktop/tablet/mobile. The active browser suite replaces now-inapplicable Auth UI contracts; original integration references remain in e2e/.
- [~] Publish verified refinement to the existing feature branch; no Backend/database/env changes or public deployment.
