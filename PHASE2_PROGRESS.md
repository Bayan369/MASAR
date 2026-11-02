# Phase 2 — Database foundation review

Statuses: [ ] not started; [~] in progress; [x] verified complete; [!] blocked.

Scope authorized now: schema, local migration files, RLS and local tests only. No SQL against hosted masar-dev, hosted resources, UI integration, commit or push. This is a partial Phase 2 deliverable, not completed authentication or deployment.

- [x] Inspect current architecture and clean feature branch at 2df8bf2.
- [x] Define seven tables, tenant-safe relationships, indexes and constraints — both migrations applied successfully to local PostgreSQL 17 / pgvector 0.8.1.
- [x] Define database-enforced roles, document visibility and private conversation ownership — local SQL assertions passed.
- [x] Add versioned Supabase migrations and local-only configuration — TOML parsed with PostgreSQL 17 and seed disabled.
- [x] Add transaction-scoped local authorization tests — all fixture data rolled back; seven tables verified empty.
- [x] Run migrations and permission tests — 81 SQL assertions passed on repeated fresh network-disabled PostgreSQL 17 / pgvector 0.8.1 containers. Broad Supabase-style default grants were simulated and all seven tables verified fail-closed after migration 1. Fixture rollback and container removal passed.
- [x] Document relationships, permission matrix, security limits and review gates in docs/DATABASE_FOUNDATION.md.
- [x] Validate new runner with Ruff lint/format checks and config with TOML parsing; git diff --check passed. SQL migrations were executed against real local PostgreSQL, not just syntax-checked.
- [x] Verify frontend/backend/Phase 1 checklist unchanged using git diff; all execution limited to local Docker, with no hosted requests, commits, pushes or merges.
- [ ] Implement actual Supabase Auth/backend integration in a separately approved step.

Deferred decisions: embedding model/dimensions and ANN index; approved identity provisioning workflow; Storage bucket/object policies; conversation retention/source revocation. Defaults deny unimplemented paths.

## Product-completion authorization (2026-11-02)

The historical scope above records the original review-only gate. The subsequent complete-product request authorizes local application integration, additive migrations and feature-branch commits/pushes. The two original migrations remain intact. Production work is tracked in PRODUCT_PROGRESS.md; five migrations and 81+35 SQL assertions now pass locally. Auth/backend/Storage/processing/RAG/UI are implemented and covered by local tests; hosted migration/application acceptance remains blocked by external configuration and the explicit no-hosted-SQL restriction. The deferred model/provisioning/Storage/revocation decisions are documented in docs/PRODUCT_DECISIONS.md and docs/DATABASE_FOUNDATION.md.
