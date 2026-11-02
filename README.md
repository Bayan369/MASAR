# MASAR | مسار

Arabic-first employee onboarding knowledge workspace. Phase 1 provides a polished, responsive React UI and a FastAPI foundation. It does **not** provide AI answers, document ingestion, authentication, or employee records.

## Requirements

- Node.js 22+ (validated with Node 24), npm 11.
- Python 3.11+ (validated with Python 3.12).
- [uv](https://docs.astral.sh/uv/) for locked Python installation.
- Chromium for browser tests. Set `CHROMIUM_PATH` if it is not `/usr/bin/chromium`.

## Structure

```text
frontend/
  src/
    components/       # Shared primitives and question entry
    lib/              # Arabic navigation/content, API client, preferences
    pages/            # Dashboard, workspace screens, login
    App.tsx           # Routes and responsive workspace shell
    styles.css        # Tailwind import, tokens, responsive component styles
  e2e/                # Desktop/tablet/mobile Playwright checks
  .env.example        # Public API URL only
  package-lock.json   # Locked npm dependency graph
backend/
  app/
    api/routes.py     # Versioned API boundary
    config.py         # Validated environment settings
    main.py           # App factory, CORS and safe error responses
  tests/              # Health, unavailable authentication, CORS, configuration
  .env.example
  pyproject.toml
  uv.lock             # Locked Python dependency graph
```

## Install and run

From the existing checkout; cloud tasks are already isolated, so no additional worktree is needed.

Frontend, terminal 1:

```sh
cd frontend
npm ci
cp .env.example .env    # optional: defaults work locally
npm run dev
```

Backend, terminal 2:

```sh
cd backend
uv sync --frozen --extra dev
cp .env.example .env    # optional: defaults work locally
uv run --frozen uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The frontend uses port 5173; the backend uses port 8000. Backend interactive API documentation is at `/docs`. For remote browser deployments, set `VITE_API_BASE_URL` to the browser-reachable backend address and add the exact frontend origin to `MASAR_CORS_ORIGINS` (JSON array). Rebuild after changing Vite variables. Never place credentials in `VITE_` variables: they are public build-time settings.

Build: `cd frontend && npm run build`. Deploy `frontend/dist` with SPA fallback to `index.html`. Production hosting, HTTPS, authentication, rate limiting and persistence are separate future work; this phase is not a production deployment.

## API contracts

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/v1/health` | 200 with `status: ok`, service name and version; process health only |
| POST | `/api/v1/auth/login` | Always 501 `AUTH_NOT_CONFIGURED`; no credentials accepted, session or cookie created |

HTTP errors use `{ "error": { "code": "…", "message": "…" } }`. Unexpected failures return a generic Arabic message without exception details. API documentation schemas retain framework terminology.

## Validation

```sh
cd frontend
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

```sh
cd backend
uv run --frozen --extra dev pytest
uv run --frozen --extra dev ruff check app tests
uv run --frozen --extra dev ruff format --check app tests
```

Playwright runs the same functional and automated WCAG A/AA checks at desktop (1440px), tablet (900px) and mobile (390px) sizes. Automated checks do not replace a complete manual accessibility review.

Playwright starts its own Vite server when one is not already running. Tests exercise Arabic/RTL navigation, mixed-language question entry, unavailable assistant behavior, department filtering/details, knowledge filters/empty states, local preference persistence, login validation/password visibility, and mobile layout. Login tests stub **only the explicit 501 capability response**, never successful authentication. A separate live backend check can be run with `curl --fail http://127.0.0.1:8000/api/v1/health`.

In the managed cloud environment, package downloads, local servers, Chromium and FastAPI TestClient may require the official command-sandbox escalation. Use that mechanism when necessary; do not change the injected proxy settings or disable verification.

## UX and architecture

- Arabic is the only active UI locale: `lang="ar"`, `dir="rtl"`, bilingual technical labels, isolated English terms and direction-aware text entry.
- Navigation and shared Arabic content live in `src/lib/content.ts`; components separate content from reusable layout and API access. A future locale dictionary and direction selection can be added without rebuilding screens. Full English translation is not implemented.
- IBM Plex Sans Arabic is bundled locally via Fontsource; no third-party font requests. Icons use Lucide.
- Shared green/ink/sage palette, responsive sidebar, intentional empty states, visible focus indicators, skip link and reduced-motion support.
- Department names/responsibilities are **illustrative guidance**, explicitly labelled; not a verified company directory. No invented people, contacts, statistics or conversations.
- Greeting is neutral until a real profile is available. No fake employee name is used.
- Suggested questions populate an editable input. Questions are not sent to an AI service or stored as conversations. The dashboard transfers the draft question through a route query; avoid entering sensitive information in this foundation UI.
- Login checks service availability without transmitting email/password. It never redirects as if login succeeded.
- Reduced-motion preference is the only persisted setting (browser local storage). It can be cleared through browser site data.

## Next phases

The approved sequence and architecture are recorded in [ROADMAP.md](ROADMAP.md). Phase 1 remains the only implemented phase. Phase 2 uses Supabase PostgreSQL and Auth, with backend authorization and database Row Level Security (RLS); later phases add Supabase Storage, pgvector, and configurable hosted Llama inference. External resource creation and paid-service usage require explicit approval; credentials must be supplied securely. No AI, ingestion or authentication integration is claimed by the current implementation.

## Supabase client foundation

The frontend's `src/lib/supabase.ts` exports `getSupabaseClient()`, a lazy shared client using the official `@supabase/supabase-js` SDK. It is not wired into Phase 1 screens or login and does not send requests on initialization. No hosted integration, database resources or authentication flow is implemented by this configuration-only foundation.

Set these **public browser configuration** variables in `frontend/.env` (see `frontend/.env.example`):

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Supply the project's base HTTPS URL and public **publishable** key from Supabase Dashboard. Keep these empty until configuring a real project; no real values are committed. Restart Vite after local configuration changes; rebuild production assets when changing Vite variables.

Vite exposes `VITE_` values in browser code. Never use `sb_secret_`, service-role keys, database passwords or access tokens here. This module accepts only the `sb_publishable_` format and validates missing/unsafe configuration without including values in errors. `.env` is ignored by Git; do not force-add it. Legacy anon JWT keys are intentionally not supported in this publishable-key setup.

Client initialization is lazy so missing settings do not break existing Phase 1 pages. Session persistence, automatic refresh and URL-session detection are disabled until a separately approved authentication implementation. Unit tests use synthetic public configuration with network requests prohibited; passing them does not establish connectivity to a hosted project. Backend authorization and RLS remain required future work.
