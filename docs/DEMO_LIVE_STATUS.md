# MASAR Demo acceptance status — 2026-11-03

This is an interim acceptance record, **not a declaration of a completed live Demo**.

| Stage | Verified result |
| --- | --- |
| Repository | feat/phase-1-foundation; previous UTF-8 fix929171c preserved; no main merge |
| Hosted catalog | masar-dev ACTIVE_HEALTHY; PostgreSQL17.11; no seven MASAR tables/private schema/name conflicts; vector available0.8.2 but not installed; migration history empty |
| Storage | Bucket-list GET403: missing storage_read; company-documents existence/privacy still UNKNOWN; no bypass via SQL bucket rows |
| Hosted migrations | Not attempted with the current read-only token; database_migrations_write required only after Storage/conflict gates |
| Migration safety | Unapplied migration3 now uses ALTER POLICY, no top-level DROP in any of the five migration files |
| Local database verification |81+35 SQL assertions plus actual policy-OID preservation pass on network-disabled PostgreSQL17/pgvector0.8.2; local fixtures rolled back, container removed |
| App tests |131 Backend tests,20 frontend unit tests and24 browser checks passed; lint/format/typecheck/production build passed. Browser contracts are not live Auth/AI acceptance |
| Initial Admin/company | Owner supplied inputs; retained only in ignored backend/.env. No hosted account/profile/company creation yet |
| Supabase runtime integration | Public project/API URLs prepared; publishable app key and server-only app credential absent |
| Cloudflare | HTTPS host allowed, Workers Free previously confirmed; account/token absent; no actual embeddings or Llama request performed |
| Live user journey | Not performed: no successful live login, upload, indexed document, Llama answer, source, history or recovery acceptance claimed |
| Deployment/billing | No public deployment, DNS change, paid service, reset or hosted data deletion |

## Remaining owner intervention only

1. Provide narrow Management capabilities **storage_read** and **database_migrations_write**, retaining existing catalog/history/project read access. Do not request Full access. First inspect Storage, then refresh catalog/history and apply only missing migrations. Do not use a write attempt to discover token permissions.
2. Configure the existing app credentials privately: VITE_SUPABASE_PUBLISHABLE_KEY, MASAR_SUPABASE_PUBLISHABLE_KEY, MASAR_SUPABASE_SERVICE_KEY, MASAR_CLOUDFLARE_ACCOUNT_ID, MASAR_CLOUDFLARE_API_TOKEN. Keep all server credentials out of VITE variables and Git. Management PAT is not an app key.

Auth user creation uses the Supabase Admin API with the existing approved server-side credential, not a fabricated Auth row or the Management read-only token. No signing-key scopes are needed. If recovery delivery or redirect configuration later fails, diagnose the actual requirement before requesting any additional Auth configuration permission; never ask for Full access preemptively.

## Local run address and commands

The UI/API can be started inside the execution environment or on the owner's computer using the existing commands. These are loopback addresses, not a public hosting preview.

```sh
# Terminal1, backend:
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
# Terminal2, frontend:
npm run dev -- --host 127.0.0.1
```

UI: http://127.0.0.1:5173; API liveness: http://127.0.0.1:8000/api/v1/health. Start `uv run python -m app.worker` only after hosted migrations/Storage and runtime credentials are verified. Auth remains safely blocked with missing keys; a healthy local server is not a working authenticated Demo.

Input document: demo/masar-demo-guide.txt, a clearly labeled technical test guide with no invented company policy. Owner identity/login credentials must remain private. No actual password has been generated for an account that does not yet exist.
