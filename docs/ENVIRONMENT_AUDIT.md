# Environment audit — MASAR (2026-11-04)

## Observed workspace and limits

Reviewed `/workspace/MASAR` on `feat/public-llama-demo`, preserving existing local changes. Root `.env`, `backend/.env`, `backend/.env.txt`, and frontend `.env`, `.env.local`, `.env.development`, `.env.production` are absent here. Cloudflare account/token and MASAR application settings are not injected into this process. This observation does not describe the user's separate Windows checkout. No secret values or live API requests were used.

Parsed the root, backend, frontend and deploy env examples: no invalid lines, duplicate assignments or unknown active application keys. Backend's example covers every Settings field; blank credentials and Free confirmation=false are intentional safe placeholders, not real configured AI. Actual hosted Cloudflare quota, permission scopes and remaining account balance cannot be verified offline.

## Actual Backend Settings variables

All these keys are read through Pydantic `MASAR_` prefix, even though individual accesses use snake_case properties:

- `MASAR_SUPABASE_URL`
- `MASAR_SUPABASE_PUBLISHABLE_KEY`
- `MASAR_SUPABASE_SERVICE_KEY`
- `MASAR_AUTH_REDIRECT_URL`
- `MASAR_RETRIEVAL_MODE`
- `MASAR_DEMO_ENABLED`
- `MASAR_MAX_UPLOAD_BYTES`
- `MASAR_AI_CALL_BUDGET`
- `MASAR_CLOUDFLARE_ACCOUNT_ID`
- `MASAR_CLOUDFLARE_API_TOKEN`
- `MASAR_CLOUDFLARE_MODEL`
- `MASAR_CLOUDFLARE_FREE_PLAN_CONFIRMED`
- `MASAR_SEMANTIC_MIN_SIMILARITY`
- `MASAR_RERANK_MIN_SCORE`
- `MASAR_DEMO_REQUESTS_PER_MINUTE`
- `MASAR_DEMO_MAX_CONCURRENT`
- `MASAR_DEMO_TOTAL_REQUESTS`
- `MASAR_DEMO_MAX_IPS`
- `MASAR_APP_NAME`
- `MASAR_ENVIRONMENT`
- `MASAR_CORS_ORIGINS`

`backend/.env` is resolved from `app/config.py`, not the shell working directory. It now explicitly uses `utf-8-sig` so UTF-8 files with or without a Windows BOM load correctly. Precedence: explicit Settings arguments > process environment > dotenv > default values (no custom secret-file directory configured). Duplicate assignments within one dotenv use the last definition; process values can override it again. Keep one active `MASAR_ENVIRONMENT`. `get_settings()` caches settings; restart Backend after changes. `.env.example` is never loaded automatically.

For local anonymous AI chat: `MASAR_ENVIRONMENT=development`, explicitly `MASAR_DEMO_ENABLED=true`, valid backend-only Cloudflare account (32 hex characters), nonempty backend-only API token authorized for the intended Workers AI models, and `MASAR_CLOUDFLARE_FREE_PLAN_CONFIRMED=true` only after the operator confirms the existing plan. Model default is `@cf/meta/llama-3.1-8b-instruct-fp8-fast`. Budget default remains 20 (1–500 allowed), shared across embedding/generation attempts, not an account-quota or billing check. Neither secrets nor the budget were modified. No actual `.env` was created and no enablement was silently applied.

`MASAR_CORS_ORIGINS` must be a JSON array, for example `["http://localhost:5173","http://127.0.0.1:5173"]` locally. Hosted `demo` requires explicit non-wildcard HTTPS origins, configured AI and explicit demo enablement. `production` rejects demo enablement and requires configured Supabase/AI; do not copy the production deployment template to enable a local demo. Supabase settings are for authenticated company features and are not required by anonymous Demo.

## Frontend and Proxy variables actually read

| Key | Reader and location | Requirement |
|---|---|---|
| `VITE_ASSISTANT_MODE` | `src/demo/llama.ts`, build/dev-time | Any value except `offline` selects the real API; documented `llama`. `offline` explicitly selects the diagnostic local engine. |
| `MASAR_LOCAL_API_ORIGIN` | `vite.config.ts`, Vite dev server only | Optional, default `http://127.0.0.1:8000`. Fixed to load frontend dotenv files as well as process environment. No browser injection. |
| `MASAR_DEMO_BACKEND_URL` | `api/demo/ask.js` and documents handler, server runtime | Required for Vercel proxy: actual Backend HTTPS origin, no credentials/path/query/fragment, no `/api/v1` suffix. Set in hosting runtime environment; never VITE-prefixed. Not required by the local Vite proxy. |
| `VITE_API_BASE_URL` | `src/lib/api.ts` | Older/authenticated API client, default localhost:8000. Does NOT select the active `/assistant` same-origin proxy target. |
| `VITE_SUPABASE_URL` | lazy `src/lib/supabase.ts` | Public base HTTPS project URL for authenticated features; not needed by anonymous chat. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | lazy `src/lib/supabase.ts` | Public `sb_publishable_...` key only. Service-role/secret keys are rejected and never belong in VITE variables. |

Vite process variables override `.env.[mode].local` > `.env.[mode]` > `.env.local` > `.env`. Files are in `frontend/`, not the repository root. Dev normally uses mode=development, build uses production; restart Vite/rebuild after changes. The proxy-origin bug was real: the prior config read `process.env` without `loadEnv`, so a custom private origin defined only in frontend dotenv was ignored. Both document/chat dev proxy entries now use the loaded origin. Root dotenv is for Compose interpolation of frontend public build args; `compose.yaml` injects `backend/.env` into API/worker processes. Vercel runtime variables must be configured there; a frontend build dotenv file is not a substitute for function runtime configuration.

## Operational variables, timeouts and trust

- `PORT`: `scripts/start_server.py` and Docker healthcheck read PROCESS environment directly; default 8000, valid 1–65535. Merely adding it to a Pydantic dotenv does not populate `os.environ` for the Python launcher. Compose/hosting env injection or shell export does. Host remains 0.0.0.0.
- `MASAR_TRUSTED_PROXY_IPS`: launcher PROCESS environment, optional explicit IP/network list. Default trusts no forwarded headers; wildcard is rejected.
- `WEB_CONCURRENCY` is deliberately ignored: one backend worker for the documented in-memory rate limit.
- `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` are standard urllib environment settings, not additional MASAR credentials. SSL trust uses standard `SSL_CERT_FILE`/`SSL_CERT_DIR`; `REQUESTS_CA_BUNDLE` alone does not configure urllib. Present standard proxy/CA settings were not changed or exposed.
- `PATH` and Windows `SYSTEMROOT` are used by the isolated document-processing subprocess; no new setup needed for chat.
- `MASAR_RUN_LIVE_AI`, `MASAR_LIVE_EMAIL`, `MASAR_LIVE_PASSWORD`, `MASAR_LIVE_QUESTION` belong to explicit live test opt-in only; none is required to use the app. `CHROMIUM_PATH` optionally selects a local test browser. No live tests were run.
- Cloudflare request timeout is hardcoded 35 seconds per call; current chat client timeout 120 seconds and Vercel proxy timeout 110 seconds. Older API client defaults to 30 seconds. There are no MASAR timeout environment variables in the code. Platform execution limits may be lower; they were not changed.
- `max_tokens=600` is hardcoded in the provider, not an environment variable. There is no supported environment key that repairs invalid JSON or changes this limit.

## Security and root-cause distinction

Real dotenv files are ignored and untracked; backend/frontend Docker ignore rules exclude them. All edits here are loader code, example comments, tests and this report. No credentials, dotenv files, services or budgets were changed.

This workspace cannot run AI as-is: credentials/Free confirmation are absent and Demo is disabled by default. Those are definite local readiness blockers. But the user's earlier Windows `HTTP 200` followed by `rag_json_error`, schema failures or evidence-policy rejection establishes a different stage: a response reached parsing/validation. It does not establish an env-name error. The known schema/applicability issues are described in SEMANTIC_RAG.md; no further speculative RAG changes were made during this env audit. Need the actual Windows file's safe presence/format/duplicate results to conclude whether it also has configuration problems; never send its secret values in chat.


## User-provided Windows configuration clarification

The user subsequently confirmed a separate local Backend dotenv exists. Its supplied nonsecret settings specify development, demo enablement=true, Free confirmation=true, the expected Llama model, and budget=40. These are compatible with the local Demo configuration; 40 is within the allowed budget range and was NOT changed here. The account identifier was not reproduced and the token was masked: actual token validity/permissions cannot be verified offline. No duplicated environment assignment is visible in that supplied block.

If the displayed backslash before the colon in `http\://` is literally present in the CORS JSON, it is an invalid JSON escape. Correct origins use `http://` with no backslash. This exact syntax failure was reproduced locally with temporary nonsecret files; valid JSON is accepted. If the backslash came only from chat formatting, no file change is warranted. Literal prose appended to the numeric budget line would also be invalid, but text added only in chat is not a configuration issue. These observations do not justify changing the user's secrets or budget. An invalid CORS JSON blocks settings load at startup; it does not explain malformed Llama JSON after a successful upstream response by itself.
