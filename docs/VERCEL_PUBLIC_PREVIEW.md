# Vercel readiness: public static frontend

This configuration prepares the currently active local-data MASAR UI. It does not enable FastAPI, Supabase, authentication, document ingestion or hosted inference. The seven departments and thirteen documents remain public bundled content, and conversations retain their existing in-memory behavior.

## Project settings to review before deployment

| Setting | Value |
| --- | --- |
| Git branch | `feat/phase-1-foundation` |
| Root Directory | `frontend` |
| Framework | Vite |
| Node.js | 24.x, compatible with the existing package engines |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` relative to `frontend` |
| Required environment variables | None |

Root Directory must be selected in Vercel Project Settings; it is not a key inside `vercel.json`. The remaining build fields are saved in `frontend/vercel.json`. No installation, Vercel project linking, deployment, environment-variable creation or external service configuration is part of this change. Connecting a Git repository to Vercel may enable automatic deployments; review that separately before publishing changes remotely.

## Routing and assets

The SPA rewrite serves `index.html` for client routes, including direct entry and browser refresh on `/assistant`, department details, procedures and document-reading URLs. Static build assets and `/masar-gateway.svg` retain their native file responses. The existing Vite root base is appropriate for a Vercel domain-root deployment and needs no modification.

The compiled application must not contain loopback URLs with service ports. React Router may retain a bare `localhost` string as an internal URL parsing base; that is not an API connection. The dormant API helper's development fallback remains unchanged and is not imported by the current application. Re-enabling integrations is a separate task.

## Security headers

- CSP permits scripts, styles, images and connections from the same origin. Fonts may additionally use `data:` because Vite inlines small local WOFF/WOFF2 files into the built CSS. This exception grants no remote font origin. It grants neither `unsafe-inline` nor `unsafe-eval`, nor broad HTTPS/localhost connection exceptions.
- Inline script/style attributes, plugin objects and framing are blocked. Forms remain same-origin.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and restrictive camera/microphone/geolocation permissions are included.
- No CORS wildcard, service credentials or environment variables are added. Vercel supplies HTTPS hosting; the repository's Nginx configuration is not used for this deployment.

Future external APIs, analytics, embedded content or inline styling require a deliberate policy review. Do not broaden this static-frontend policy by copying the Nginx policy.

## Local verification

From `frontend`:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:vercel
```

`test:vercel` builds production output and runs all existing desktop/tablet/mobile browser cases, plus deployment-specific checks, against `scripts/serve-vercel-build.mjs`. That loopback-only adapter reads the actual `vercel.json`, applies the global headers, serves existing files, and applies the configured SPA fallback. It refuses unsupported routing changes rather than silently testing different rules.

The browser checks cover direct URLs and refresh, CSP violations and console/network failures, JS/CSS/font MIME responses, logo loading, localhost-service URL exclusion in production JavaScript, RTL, accessibility, navigation, sources and conversation behavior. These are local contract checks; they do not claim to execute Vercel's routing engine or validate a live deployment. No new dependencies are required. Ordinary `npm run test:e2e` remains available for the existing Vite Preview workflow.
