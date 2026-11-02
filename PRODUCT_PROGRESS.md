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
- [x] Verify backend — **126 pytest tests**, Ruff lint/format pass.
- [x] Verify frontend — **20 unit tests**, TypeScript/lint/Prettier/build pass; **24 Chromium browser checks** across desktop/mobile/tablet, including Axe WCAG checks, settled empty states and deep source navigation.
- [x] Inspect actual rendered desktop/mobile UI with clearly labeled offline browser fixtures; fix empty-notice contrast and settings alignment.
- [x] Resolve dependency audit advisories — patched Vitest/ESLint and API-compatible minimatch override; **npm audit: zero vulnerabilities**, including development tooling.
- [x] Prepare and build API/web production Docker images; verify non-root/read-only/network-isolated health, SPA routes, anonymous API denial and worker fail-closed behavior. Correct image ownership and localhost health probes. Remove smoke containers.
- [x] Validate Compose/TOML; add private/public environment templates, manual CI workflow, deployment/operations/backup/migration/Auth/Free-account/live-acceptance instructions. CI itself not executed on GitHub.
- [x] Commit and push backend/database milestone — `d4bed63`, feature branch only.
- [~] Commit/push remaining verified UI and release milestones; verify remote equality and clean working tree.
- [!] Real Supabase Auth/Storage/RLS gateway and Cloudflare embeddings/inference acceptance: credentials are unset; Cloudflare hostname not in current runtime allowlist; hosted SQL/data writes/deployment prohibited. Owner must complete approved external setup and permit the live acceptance procedure. No live success claimed.
- [!] Hosted backup/restore drill and production rollout: require selected hosting, approved Supabase/Storage backup configuration and isolated restore destination; not performed against hosted data.

Environment restart recovery: all source changes survived; orphaned local test servers were stopped and the final24 browser tests, image builds/smoke and126 backend tests were rerun successfully. The restricted environment/network configuration was not changed. No secret `.env` file was committed or included in images.

Evidence: docs/VALIDATION.md. Setup/deployment: docs/DEPLOYMENT.md. Architecture/security: docs/DATABASE_FOUNDATION.md and docs/PRODUCT_DECISIONS.md. Original PHASE1_PROGRESS.md remains the historical foundation checklist; no development checklist is rendered in the employee UI.
