# MASAR | مسار

Arabic-first, RTL internal knowledge assistant. React 19 / TypeScript / Vite 6 / Tailwind 4 frontend; Python / FastAPI backend; Supabase Auth, PostgreSQL/pgvector and private Storage; Cloudflare Workers AI Llama and multilingual BGE-M3 embeddings.

The production path uses **authenticated company documents**, never the packaged fictional demo corpus. Actual hosted Auth/Storage/inference verification is pending external configuration and approved migration application. See [PRODUCT_PROGRESS.md](PRODUCT_PROGRESS.md) for verified evidence and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for release steps. No hosted migrations or deployment were performed during development.

## Structure

```text
frontend/src/auth/             Supabase session and protected routes
frontend/src/components/       Shared Arabic RTL components and assistant
frontend/src/pages/            Employee/admin workflows, login and recovery
frontend/src/lib/              Typed API, public SDK configuration, resources
frontend/e2e/                  Offline browser contracts and real anonymous API checks
frontend/e2e-live/             Explicit opt-in real authenticated AI smoke test
backend/app/api/              Protected company/document/conversation/chat endpoints
backend/app/services/         Verified identity, Storage boundary, extraction, RAG and AI
backend/app/worker.py          Durable document-processing worker
backend/scripts/              Operator bootstrap and historical demo smoke tool
backend/tests/                Authorization, processing, evidence and transport tests
supabase/migrations/          Five ordered local migration files (not applied hosted)
supabase/tests/               Isolated local PostgreSQL/RLS assertions
compose.yaml                  API, worker and production static frontend
deploy/                      Public/server production environment templates
docs/                        Architecture, database, deployment and validation
```

## Run locally

Requires Node.js 22.13+, Python 3.11+ (tested on 3.12), uv and optionally Docker. Never put secret/server keys in `VITE_` variables. `.env` files are ignored by Git and excluded from Docker contexts.

```sh
git switch feat/phase-1-foundation
git pull --ff-only origin feat/phase-1-foundation
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
cd backend
uv sync --frozen --extra dev
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

Configure the copied files privately using the variables below. In separate terminals:

```sh
cd backend
uv run python -m app.worker
```

```sh
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. Without external configuration, login fails safely; there is no simulated authentication or demo-mode substitute. Health: `http://127.0.0.1:8000/api/v1/health`. Development API docs: `/docs`. Invite an initial Auth user and use the explicit operator bootstrap described in the deployment guide **after** approved migrations. No default user/company/password is seeded.

## Configuration

| File | Variables |
| --- | --- |
| `frontend/.env` | `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `backend/.env` | `MASAR_SUPABASE_URL`, `MASAR_SUPABASE_PUBLISHABLE_KEY`, **server-only** `MASAR_SUPABASE_SERVICE_KEY`, `MASAR_AUTH_REDIRECT_URL` |
| `backend/.env` | **server-only** `MASAR_CLOUDFLARE_ACCOUNT_ID`, `MASAR_CLOUDFLARE_API_TOKEN`, `MASAR_CLOUDFLARE_MODEL`, `MASAR_CLOUDFLARE_FREE_PLAN_CONFIRMED` |
| `backend/.env` | `MASAR_ENVIRONMENT`, `MASAR_CORS_ORIGINS` (JSON array), `MASAR_RETRIEVAL_MODE`, `MASAR_AI_CALL_BUDGET`, `MASAR_DEMO_ENABLED=false` |

Use a **publishable** key (`sb_publishable_…`) in public/browser settings; secret or legacy service-role keys are rejected there. Server service key may be a Supabase secret key or legacy service-role JWT. Never reuse it in browser configuration. Only set Free confirmation true after verifying the account is on Workers Free. Default Llama: `@cf/meta/llama-3.1-8b-instruct-fp8-fast`; embedding model: `@cf/baai/bge-m3`, 1024 dimensions. Hybrid retrieval combines vector similarity with lexical relevance; `lexical` is an explicit operator diagnostic option, never an automatic AI failure fallback.

`MASAR_AI_CALL_BUDGET=20` limits chat+embedding requests per process (each worker/API has its own counter); it is **not** an account-wide daily billing meter. Keep Workers Free enabled. Quota/auth/network failures halt that provider process; workers do not automatically restart. Review the safe error code and Free usage before a manual restart. There are no paid fallbacks or automatic inference retries.

## API

All routes below `/api/v1` require a bearer session except `GET /health`.

- Account: `GET /me`, `PATCH /profile` (display name only), `PATCH /company` (admin).
- Departments: `GET /departments`; admin `POST`, `PATCH /{id}`, `DELETE /{id}`.
- Members: admin `GET /members`, `POST /members/invite`, `PATCH /members/{id}`. Self role/company/activation changes are denied.
- Documents: `GET /documents`, `GET /documents/{id}`, `GET /documents/{id}/chunks`, `GET /documents/{id}/download`; admin upload `POST /documents` (multipart), `PATCH /documents/{id}`, `POST /documents/{id}/retry`, `DELETE /documents/{id}`.
- Assistant: `POST /assistant/ask` with `question`, optional `conversation_id`, UUID `request_id`; response contains answer, exact sources, conversation/request IDs.
- Conversations: `GET /conversations`, `GET /conversations/{id}/messages`, `PATCH /conversations/{id}`, `DELETE /conversations/{id}`. Always owner-only, including for admins.

Original demo endpoints are disabled by default and unavailable in production. Historical demo scripts require explicitly enabled local demo mode; they are not production validation tools.

## Verify

```sh
cd backend
uv run ruff check app tests scripts
uv run ruff format --check app tests scripts
uv run pytest -q
cd ../frontend
npm run lint
npm run format:check
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Browser tests need Chromium (`CHROMIUM_PATH` or `/usr/bin/chromium`). They explicitly use synthetic **test-only** authentication/data contracts; anonymous API rejection is tested against actual local FastAPI. They do not establish hosted integration success.

```sh
docker pull pgvector/pgvector@sha256:3e8b3adfd27b5707128f60956f62a793c3c9326ea8cfaf0eab7adccb5d700b21
python supabase/tests/run_local.py
```

The SQL runner accepts no remote database URL, starts a network-disabled disposable local PostgreSQL container, applies all migrations, verifies permissions/constraints and rolls back every fixture. See [docs/VALIDATION.md](docs/VALIDATION.md) for results and the opt-in live smoke procedure.

## Boundaries

PDF/DOCX/UTF-8 TXT, 5MiB, 100 PDF pages, 100k extracted characters, at most 80 chunks. Scanned/encrypted/empty documents report failure; OCR is outside the supported product. No HRMS, external document connectors, billing setup, open company signup or SSO provider assumptions. Production readiness still requires configured external services, approved migrations, real document/identity acceptance testing and TLS hosting. [Security and operational limits](docs/DEPLOYMENT.md#operations-and-security).
