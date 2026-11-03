# MASAR public Llama demo (limited trial)

## Status and isolation

The code supports an explicit `MASAR_ENVIRONMENT=demo`. This is not a deployment or a claim of live inference. Existing `production` validation still requires Supabase, HTTPS origins/redirect and Workers Free AI, and still rejects Demo. Missing environment settings never enable Demo automatically.

Hosted Demo exposes health, readiness and `/api/v1/demo/*`, not the authenticated product/chat routers. It uses no Supabase Auth or database. Existing product functionality is retained in other modes. Local development Demo behavior is retained. Do not change an existing production service to Demo; use an existing separate non-production Backend service and Vercel Preview environment.

## Backend settings (server only)

| Variable | Demo value / meaning |
| --- | --- |
| `MASAR_ENVIRONMENT` | `demo` (required) |
| `MASAR_DEMO_ENABLED` | `true` (required) |
| `MASAR_CLOUDFLARE_ACCOUNT_ID` | Existing account ID, configure privately |
| `MASAR_CLOUDFLARE_API_TOKEN` | Existing server-only token authorized for Workers AI inference |
| `MASAR_CLOUDFLARE_MODEL` | `@cf/meta/llama-3.1-8b-instruct-fp8-fast` |
| `MASAR_CLOUDFLARE_FREE_PLAN_CONFIRMED` | `true` only after confirming Workers Free |
| `MASAR_CORS_ORIGINS` | JSON array containing the exact HTTPS Vercel trial origin, no wildcard or trailing slash |
| `MASAR_DEMO_REQUESTS_PER_MINUTE` | Default 6 per peer IP, fixed 60-second window |
| `MASAR_DEMO_MAX_CONCURRENT` | Default 1; the existing provider also allows only one inference at a time |
| `MASAR_DEMO_TOTAL_REQUESTS` | Default 100 admissions per process lifetime; 0 disables only this limit |
| `MASAR_DEMO_MAX_IPS` | Default 10000 active IP windows; refuse new keys at capacity |
| `MASAR_AI_CALL_BUDGET` | Existing default 20 provider attempts per process; independent of Demo admissions |
| `PORT` | Hosting port; default 8000 |
| `MASAR_TRUSTED_PROXY_IPS` | Default empty: ignore forwarded headers. Optional verified proxy IP/CIDR list, comma-separated, never `*` |

Keep credentials in the existing hosting service's private environment settings. Never send them in chat, put them in `VITE_` variables, or commit `.env`. `.gitignore` and the backend Docker allowlist exclude `.env*`, keys and certificates. No Supabase variables are needed for this mode. Normal Python/proxy TLS trust may still require host-specific CA configuration; never disable TLS verification.

## Backend launch

Working/root directory: `backend`. Python 3.12 is used by the existing image.

```sh
uv sync --frozen --no-dev
uv run --frozen --no-dev python -m scripts.start_server
```

Or build the existing `backend/Dockerfile` with `backend` as its build context. Its command runs the same entrypoint; both the listener and Docker healthcheck read `PORT`. `EXPOSE 8000` is image metadata, not a port override. Configure the host's health path to `/api/v1/health`; optional readiness is `/api/v1/ready`. Neither calls Cloudflare. Readiness checks local RAG availability and whether the provider has latched a failure; it does **not** prove credentials, quota or outbound connectivity work.

Use exactly **one replica and one Uvicorn process**, disable autoscaling, and do not wrap this command in a multi-worker process manager. The entrypoint explicitly uses `workers=1`, irrespective of `WEB_CONCURRENCY`. Production owners must separately review their existing worker topology before adopting this new entrypoint.

## Vercel Preview wiring (existing project only)

Root `frontend`, framework Vite, install `npm ci`, build `npm run build`, output `dist`. Use a Demo branch Preview deployment, not the Production target. Set for this branch/Preview scope only:

- The assistant uses the Backend API by default. `VITE_ASSISTANT_MODE=llama` remains accepted; `VITE_ASSISTANT_MODE=offline` explicitly selects the retained legacy offline showcase. Offline mode is never an error fallback and must never be labeled live AI.
- `MASAR_DEMO_BACKEND_URL`: existing public HTTPS Backend **origin**, no credentials/path/query. This is a Vercel server-side variable, not a `VITE_` variable.

The browser posts to `/api/demo/ask`. `api/demo/ask.js` forwards only the validated question to `/api/v1/demo/ask`. It forwards no Cloudflare credentials, cookies, authorization or user-supplied IP headers. The Backend URL is fixed by server configuration, with HTTPS required and redirects disabled. Responses are non-cacheable. The 60-second function maximum and 40-second proxy timeout accommodate the existing 35-second provider timeout; verify the existing Vercel plan supports these durations.

The SPA rewrite explicitly excludes `/api/` so API functions are never rewritten to HTML. The local test adapter returns 404 for API paths; it does not implement the Vercel function runtime. Proxy unit tests separately exercise the function handler.

The same-origin proxy retains the current strict `connect-src 'self'` CSP. No broad CSP or CORS exceptions are needed. Behind this proxy the Backend generally sees the proxy's peer IP: the per-IP limit may aggregate multiple visitors and can vary with serverless egress. The global total/concurrency limits still apply within the single Backend process. Do not blindly trust `X-Forwarded-For` to work around this. Any trusted proxy configuration must correspond to a verified infrastructure IP/CIDR and header-sanitization policy.

## RAG, provenance and errors

Demo keeps the existing 12 packaged passages under `app/demo_documents`. The default hybrid mode adds BGE-M3 vector retrieval, Llama query rewriting/reranking and synonym-free BM25; see [Semantic RAG](SEMANTIC_RAG.md). It does not alter document processing or replace the seven departments/thirteen frontend documents. These corpora are not identical: only the packaged Backend Demo passages ground live answers. Sources appear inline with exact quotes and links to the actual packaged RAG documents; unrelated frontend documents are not substituted. Arabic is the default answer language, with the existing explicit English-request support retained.

The backend validates model JSON, evidence IDs, exact quotations and numeric claims. Valid answered responses include the Llama model/provenance. No evidence may yield a documented not-found without calling the model; this is not evidence that inference succeeded. Failed inference returns an error, never an offline answer. The live-mode UI has no local responder fallback. The frontend sends the most recent ten user/assistant turns (up to 2000 characters per turn) to the same Demo endpoint. The backend uses prior user questions to retrieve evidence for short confirmations and passes history as untrusted context, never as an evidence source. There is no server-side conversation storage. Pure greetings receive a clearly conversational, source-free social response without invoking or claiming Llama.

## Trial limitations

Rate limits are **temporary, in-memory and local to one process**, reset on restart, and are not shared across replicas. They do not establish billing caps or distributed protection. Anonymous users sharing a network/proxy may share limits. CORS is a browser policy, not authentication; direct callers can reach this public endpoint. This is a limited training trial, not a large public launch. Stop or restrict the trial if abused; do not restart to circumvent quotas. No login, access code, Redis, account or external service is created by these changes.

## Verification and acceptance

```sh
# backend
.venv/bin/ruff check app scripts tests
.venv/bin/ruff format --check app scripts tests
.venv/bin/python -m pytest -q
# frontend
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:proxy
npm run test:vercel
npm run test:public-demo
npm run test:local-api
```

Public-Demo browser tests mock the API and verify actual live-mode UI wiring, sources, failure rendering and absence of offline fallback. Backend tests mock Cloudflare and verify RAG evidence, isolation, CORS, rate/concurrency limits and port handling. **These tests do not prove live Cloudflare connectivity.**

After the existing service credentials and Preview deployment are available, ask `كم مدة الإجازة السنوية؟` from the published UI. Check the browser POST succeeds, response has `status=answered`, the configured `model`, `generated_by=Cloudflare Workers AI / Llama`, exact sources, and correlate with a `workers_ai_success` Backend log. Never share token-bearing requests or environment dumps. Record the actual Preview URL and commit only after successful deployment; no URL is invented here.

## Local frontend/API parity

Run the existing Backend with Demo enabled and the actual Cloudflare settings, then run `npm run dev` in `frontend`. Vite forwards `/api/demo/ask` to `http://127.0.0.1:8000/api/v1/demo/ask` without Vercel. Set the server-only `MASAR_LOCAL_API_ORIGIN` process variable for a different local API port. The same endpoint and 12 Backend RAG passages power both direct API and UI questions; UI document summaries are not an alternative answer source. Source IDs, document IDs, titles, sections, excerpts and quotes are retained from the API response without manufacturing links to unrelated frontend documents.

`test:local-api` starts actual local FastAPI and Vite processes with no model credentials. It verifies greeting delivery and that factual questions fail explicitly when AI is unavailable; it does not simulate a successful inference. `test:public-demo` separately uses declared API fixtures to check source rendering and context forwarding. Neither proves a live Cloudflare answer.
