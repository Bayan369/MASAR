# MASAR Public Demo on Render

Scope: the existing explicit Demo mode, packaged RAG documents, public conversation,
exact answer sources, and the existing knowledge explorer. No company accounts,
Supabase setup, uploads, ingestion worker, or new external service is needed.
The existing production application, worker and protected endpoints remain in code.
Demo does not register those protected endpoints. The current UI already has no
company-upload controls, so no unavailable upload action is introduced.

## Services and exact settings

Both services use **feat/public-llama-demo**, never main. `render.yaml` describes
only these two services and disables automatic deployment. Nothing here deploys.

| Setting | Static Site | Web Service |
| --- | --- | --- |
| Root directory | `frontend` | `backend` |
| Runtime | Static | Docker |
| Build | `npm ci && npm run build` | Existing Dockerfile build |
| Publish directory | `dist` | Not applicable |
| Dockerfile / context | Not applicable | `./Dockerfile` / `.` relative to backend |
| Start | Static hosting | Existing image CMD: `python -m scripts.start_server` |
| Health | Not applicable | `/api/v1/health` |
| Plan | Static hosting | `free`, if available for your account |
| SPA route | Rewrite `/*` to `/index.html` | Not applicable |
| Auto-deploy | Off | Off |

The API binds `0.0.0.0` and reads Render's `PORT`; do not hardcode a port or
replace the entrypoint with a multi-worker command. Exactly one process/replica.
Docker's `EXPOSE 8000` is metadata, not the listener's production port.
`/api/v1/ready` checks local prerequisites only. Neither health endpoint calls AI.
The image retains the packaged Markdown; no persistent local disk is needed.
Existing Docker/Git ignore rules exclude real dotenv files.

## Minimal environment configuration

Set these **only on the Backend**, never on the Static Site:

- `MASAR_ENVIRONMENT`: explicit `demo` (preconfigured in the blueprint).
- `MASAR_DEMO_ENABLED`: explicit `true` (preconfigured).
- `MASAR_CLOUDFLARE_ACCOUNT_ID`: existing account setting, enter privately.
- `MASAR_CLOUDFLARE_API_TOKEN`: existing server-only Workers AI token, enter privately.
- `MASAR_CLOUDFLARE_FREE_PLAN_CONFIRMED`: confirm the actual account plan yourself.
- `MASAR_CORS_ORIGINS`: JSON array containing only the actual HTTPS Static Site
  origin, without paths or trailing slash. No wildcard. Use its final custom
  domain instead if that is the domain visitors will use.
- `MASAR_AI_CALL_BUDGET`: enter the existing approved limit unchanged. The
  blueprint deliberately does not invent or raise a budget.

The current model, hybrid retrieval and thresholds already have defaults:
`MASAR_CLOUDFLARE_MODEL`, `MASAR_RETRIEVAL_MODE`, `MASAR_SEMANTIC_MIN_SIMILARITY`,
`MASAR_RERANK_MIN_SCORE`. Do not override them for this deployment. The existing
`MASAR_DEMO_*` request/concurrency/total/IP defaults remain active; no extra
variables are required to enable them. `MASAR_TRUSTED_PROXY_IPS` stays unset
unless you have verified Render's proxy addresses and forwarding policy. Never
use `*` or trust client-supplied forwarded IPs.

Set these on the **Static Site**:

- `VITE_API_BASE_URL`: the actual public HTTPS Backend **origin**, without an
  `/api` suffix, credentials, query, or fragment. It is public build-time config;
  changing it requires rebuilding the Static Site.
- `VITE_ASSISTANT_MODE`: `llama` (preconfigured; already the default).
- `NODE_VERSION`: the blueprint selects the supported Node 24 major for builds.

**No Supabase variables, service keys, `MASAR_DEMO_BACKEND_URL`, or Cloudflare
credentials belong on this Static Site.** Do not add them to frontend dotenv,
Render frontend settings, or Git. Do not set `PORT` manually.

## Manual setup order

1. In Render, connect the existing GitHub repository and select the Demo branch.
   Create the Static Site with the settings above, SPA rewrite and security
   headers in `render.yaml`. Keep automatic deployments off. If the Backend
   origin is not yet known, leave that single frontend variable unset for the
   initial setup; the UI can build but chat is **not ready**. Do not share it yet.
2. Copy the Static Site's **actual** HTTPS origin shown by Render. Create the
   Docker Web Service, select Free if available, and privately configure the
   Backend variables above, including exact CORS. No Worker or database resource.
3. Copy the Web Service's **actual** HTTPS origin into the Static Site's
   `VITE_API_BASE_URL`. Manually rebuild the Static Site. Verify actual URLs;
   requested service names are not proof that a particular hostname was assigned.
4. Confirm `/api/v1/health`, load `/assistant` and `/documents/leave` directly,
   and refresh them. From the UI send a greeting and one documented question.
   Inspect that the POST goes to the Backend's `/api/v1/demo/ask`, not the Static
   Site or Vercel. Open an answer's source; it must reach the Backend's
   `/api/v1/demo/documents/{id}` and contain its displayed exact quotation.
5. Publish/share the link **only after** a real documented Llama response with
   sources is verified. Local fixtures/builds alone do not prove this.

The blueprint is reproducible configuration, not dynamic discovery of both
public origins. If using Blueprint setup after the origins are known, fill the
`sync: false` values privately and verify assigned URLs before sharing.
Security headers are listed explicitly because `frontend/vercel.json` is not
applied by Render. If you add CSP in Render's dashboard, include the exact
Backend origin in `connect-src`; copying Vercel's `connect-src 'self'` would block
the direct connection. No broad `https:`/wildcard policy is introduced here.

## Routing, compatibility and validation

With `VITE_API_BASE_URL`, chat goes directly to `/api/v1/demo/ask`. The Backend's
bounded relative source reference is mapped to that same configured origin;
source text, section, evidence IDs and API response values are not rewritten.
Arbitrary absolute URLs or paths received as source references are not accepted.
Without the variable, the existing local Vite/Vercel proxy paths remain usable.
Production browser configuration rejects HTTP origins; loopback HTTP is allowed
only for development/test builds. No inference/rewrite/rerank logic is changed.

Run from `backend`: `uv run --frozen --no-dev python -m pytest -q`, Ruff check
and format check. Run from `frontend`: unit tests, typecheck, build, lint,
format check, `npm run test:proxy`, `npm run test:demo`,
`npm run test:public-demo`, and `npm run test:render`.

`test:render` builds static assets and contacts actual local FastAPI Demo routes
on a separate origin. Its test-only host blocks every external AI call and
returns **no successful model answers**. A separately labeled UI transport fixture
opens an actual source document from that same FastAPI host; it is not a model
quality or live-inference claim. The suite verifies greetings, real packaged
source text, CORS, hidden company routes, and honest unavailable-AI errors.
`test_render_demo.py` separately verifies grounded answer/source contracts using
an explicitly synthetic provider fixture. These tests do not prove live Llama
connectivity. The test-only app is outside the Docker image; never host it.

## Limits and deferred functionality

- Free Web Services can sleep/restart; first access may be slow and in-memory
  vectors must be rebuilt. Confirm current Free availability/terms in Render's
  dashboard. Official docs were inaccessible from this workspace (HTTP 403), so
  account-specific limits and current pricing are not claimed as verified.
- Request/IP/concurrency/total limits and the AI attempt counter are local to
  one Backend process. They reset on restart and are not centralized or durable
  account-wide spend controls. Keep one replica and do not raise the budget.
- With forwarded IPs untrusted, the per-IP window may group users behind a
  hosting proxy. This is conservative limiting, not verified per-visitor identity.
- The 120-second client timeout and current model/token/provider timeouts remain
  unchanged. A cold/multi-stage AI request may time out; this deployment does not
  repair model outputs or guarantee successful generation.
- Demo uses four packaged Markdown documents / twelve RAG passages. The thirteen
  existing frontend knowledge entries remain an explorer, not an assertion that
  all thirteen are indexed by live Demo RAG.
- Company uploads and ingestion remain deferred. Full company mode needs existing
  Supabase configuration and a persistent independent worker; do not assume a
  Free Background Worker or run its infinite loop inside this API.

## Local verification for this change

- Backend: 418 tests; Ruff lint/format passed.
- Frontend: 57 unit tests; TypeScript, Vite build, ESLint, Prettier passed.
- Browser runs: workspace 27, public-demo contracts 18, local Vite/API 3,
  Vercel compatibility 30, direct Render-style static/API 6: all passed.
- Existing Dockerfile built successfully. The image ran with external networking
  disabled and a nondefault PORT: health/readiness, original documents, company
  route isolation, and exclusion of dotenv/test-host files passed.
- These are local checks, not a Render deployment or a live Cloudflare test.
