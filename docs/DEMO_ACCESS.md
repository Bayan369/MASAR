# Demo access gates — 2026-11-03

## Current verified state

- Project: masar-dev; Management metadata read succeeds. Schema inventory/conflicts are **not** established by PostgREST OpenAPI.
- The current token has working database metadata/history read access. `GET /database/context` requires **database_read**, which is already available; history GET requires **database_migrations_read**.
- Bucket listing remains HTTP403: **Missing required permission(s): storage_read**. No objects/files were accessed and no alternate route was used to bypass this denial.
- Catalog SELECTs were subsequently explicitly authorized and executed through the official read-only endpoint. PostgreSQL17.11, no MASAR public tables, no private schema, no conflicting MASAR names, vector not installed but available0.8.2, and no policies in public/private/storage were confirmed from real catalogs. See demo/catalog-preflight-summary.json. Bucket metadata remains separately gated by storage_read.
- Local API/UI are running, backed by real application code and no fake session. API health and actual login rendering are verified separately from hosted acceptance. Runtime Supabase/Cloudflare credentials are absent, so authentication/ingestion/inference remain unverified.

## Exact minimum permissions and authorization

| Operation | Fine-grained permission | OAuth scope, if using OAuth | Current gate |
| --- | --- | --- | --- |
| Catalog metadata via POST `/v1/projects/{ref}/database/query/read-only` | `database_read` | `database:read` | Owner authorized catalog SELECTs; actual read-only request succeeded (HTTP201) |
| Bucket names/public settings via GET `/v1/projects/{ref}/storage/buckets` | `storage_read` | `storage:read` | Missing; add only this read capability |
| Apply reviewed migrations via POST `/v1/projects/{ref}/database/migrations` | `database_migrations_write` | `database:write` | Needed only after schema/extensions/RLS/bucket conflicts are fully checked and reported; never assume the current read token can write |

Names come from the official Management OpenAPI `x-fga-permissions` / `x-oauth-scope`, read from https://api.supabase.com/api/v1-json. Do not request Full access. Do not test write permission by attempting a migration.

Reviewed and executed read-only after explicit approval: DEMO_PREFLIGHT_CATALOG_READ_ONLY.sql. One catalog-only SELECT returns extension names/versions/schemas, table columns/constraints/RLS flags, policy metadata and object names/signatures. It does not read user records, secret values, function bodies, bucket rows or Storage objects. Refresh the approved catalog inspection before any migration application. Bucket metadata must still use its independently authorized `storage_read` endpoint.

## Private application configuration

Harmless local API/project URLs are now set in existing ignored .env files only when empty; all existing values were preserved. The remaining values must be entered privately, not retrieved from secret/key endpoints or pasted into chat:

- frontend/.env: `VITE_SUPABASE_PUBLISHABLE_KEY` (public browser key).
- backend/.env: `MASAR_SUPABASE_PUBLISHABLE_KEY`, **server-only** `MASAR_SUPABASE_SERVICE_KEY`, `MASAR_CLOUDFLARE_ACCOUNT_ID`, **server-only** `MASAR_CLOUDFLARE_API_TOKEN`.
- Management PAT is not a substitute for application keys. Do not place it in VITE variables or copy it into browser/server-role fields.
- Keep the already confirmed Workers Free plan and the bounded AI call budget; never enable billing/paid fallback.
- Owner supplies approved Admin email/company/display name. Use an existing suitable Auth account or create one only after schema gates and necessary server authorization are satisfied. Keep the login password private. Bootstrap must not run yet.

Once the read gates are resolved, inspect all catalog results and bucket privacy/policies against the five local migrations. Stop on conflicts; never replay Foundation over manually created objects or relocate an existing vector extension silently. Only then obtain the narrow migration-write capability and apply missing migrations. Afterward configure/restart the local services, create/bootstrap the approved Admin, start the worker, upload docs/demo/masar-demo-guide.txt and verify actual embeddings/Llama/source/history. No hosted write is authorized to skip the conflict gate.

## Non-destructive migration verification

Migration3 now tightens messages_read using ALTER POLICY rather than DROP/recreate. The local runner checks that its OID survives the upgrade. All five files have no top-level DROP statements. All81+35 SQL checks and the policy-preservation check pass in disposable network-disabled PostgreSQL17/pgvector0.8.2, the vector version available hosted. Repeatable command:

```sh
docker pull pgvector/pgvector:0.8.2-pg17
python supabase/tests/run_local.py --image pgvector/pgvector@sha256:feb68f4f15446397d8cac7f4fe48fe4586de83160d1fc48b46283312d1a33966
```

The runner accepts only a cached exact official image digest; it never pulls or accepts remote DB URLs. Local test fixtures roll back and the disposable container is removed. This verification is not a hosted migration application.

## Auth and Storage permission distinction

Do not request signing-key privileges or Full access. The Management API bucket-list permission is storage_read; migration application/recording uses database_migrations_write. Creation of the private bucket is already part of migration4, after the existing bucket check succeeds. App uploads and initial Auth Admin creation use the server-only Supabase app credential through the existing trusted backend/Admin API. A read-only Management PAT is not that credential. No Management Auth/signing-key endpoint has been called; no Auth config changes are attempted. If Auth settings later require a change, confirm that specific need first rather than preemptively requesting broad project permissions.
