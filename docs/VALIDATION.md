# Verification record — 2026-11-02

This record distinguishes local evidence from real hosted integration acceptance. No real provider answer, Auth login, document upload, hosted SQL, deployment or hosted data modification occurred during this product-completion task.

| Check | Actual result |
| --- | --- |
| FastAPI pytest | **127 passed**, including existing citation/transport regressions and new production identity/role/upload/processing/error tests |
| Ruff backend + scripts + SQL runner | Lint and format checks pass |
| PostgreSQL 17 / pgvector 0.8.1 | **81 Foundation + 35 product SQL assertions passed**, all five migrations applied locally; RLS, tenant isolation, Arabic/English lexical and vector search, Storage policies, membership controls, worker leases/publication, exact citation persistence/revocation |
| SQL fixture cleanup | All seven application tables empty after transaction rollback; disposable network-disabled container removed |
| Frontend Vitest | **20 passed** on patched Vitest 5.1 |
| TypeScript | `npm run typecheck` and production `tsc -b` pass |
| ESLint / Prettier | Pass |
| Production Vite build | Pass; application, React and Supabase bundles split; largest JS chunk about277kB (before gzip) |
| Playwright Chromium | **24 passed**, 8 scenarios across desktop1440, mobile390 and tablet900 widths |
| Browser accessibility | Axe WCAG2A/AA/2.1AA checks passed on all eight screens across three viewports; overflow/navigation tested |
| npm audit | **0 vulnerabilities**, including development dependencies after Vitest/ESLint upgrades and patched minimatch override |
| Supabase config / Compose | TOML and Compose syntax/three-service/read-only settings validated without printing private configuration |
| Docker API/web production image builds | Passed with CA-verified package installation; non-root file ownership corrected after actual runtime testing |
| Docker runtime smoke | **Passed** API and web non-root/read-only/network-none health, SPA deep link and anonymous denial; worker exits safely with no configuration; smoke containers removed. `python scripts/container_smoke.py` |
| GitHub Actions | Manual workflow prepared, not executed on GitHub here; it does not run automatically on push or deploy |

Browser suites explicitly provide synthetic **test-only** identity/API response fixtures to exercise UI contracts; these fixtures never enter production code. Real local FastAPI anonymous requests also verify 401 and disabled demo routes. SQL harness Auth/Storage tables are minimal local compatibility fixtures; this is not a real Supabase Auth/Storage gateway. UI screenshots in `/tmp` use labeled offline browser fixtures, not live company records. Automated accessibility checks do not prove complete human assistive-technology compliance.

The initial build surfaced critical development-tool advisories; Vitest was upgraded to5.1, lint tooling upgraded to supported Node22 releases, and minimatch11.0.1+ selected for modern named API consumers. Existing hooks/exhaustive-deps lint rules remain enabled. Full lint/unit/build/browser tests were rerun, rather than suppressing advisories. Runtime dependencies were unchanged by those tooling upgrades. Use Node22.13+ LTS or a compatible newer supported LTS.

## Live acceptance blockers

Checked privately for presence only: backend Supabase URL/public key/server key and Cloudflare account/token are **unset**. The managed network is restricted and current, with the selected Supabase project hostname allowed, but no `api.cloudflare.com` rule. No environment policy was changed or bypassed. Hosted migrations are explicitly prohibited during development, so the actual schema/Auth/Storage configuration is not assumed to exist.

Consequently **no live inference, actual semantic embedding relevance, Auth recovery email, hosted RLS gateway, private Storage operation or full production question-to-persisted-answer test is claimed as successful**. These require external configuration and an operator-approved rollout, not mock answers.

## Opt-in live smoke after configuration

Follow docs/DEPLOYMENT.md first: approve/apply migrations, configure Auth/Storage/Free account, bootstrap actual admin, invite an actual test employee, start API/worker, upload an approved real document and wait for `published`. Choose a question whose answer is demonstrably in that document.

In a private shell/secret manager configure these additional test-only variables without storing them in Git or command history:

- `MASAR_RUN_LIVE_AI=true` — explicit inference opt-in.
- `MASAR_LIVE_EMAIL`, `MASAR_LIVE_PASSWORD` — real approved test account, private environment only.
- `MASAR_LIVE_QUESTION` — question answerable by the approved uploaded document; avoid confidential content in shared test logs.

Then, from frontend (ports5173/8000 free; no automatic retry):

```sh
npm run test:e2e:live
```

This test uses **no routing stubs**. It logs in through real Supabase, asks one question through the actual backend, requires a non-demo generated answer with exact chunk-backed sources and a conversation ID, and opens its real document. It writes a real private conversation as part of acceptance; execute only after the owner explicitly authorizes hosted test data writes. Live trace/video/screenshots are disabled. Keep any failure output/artifacts private. On HTTP/provider/quota failure stop and inspect safe logs; do not retry blindly or enable billing.

Also perform two-company manual acceptance: company A employee/admin must not see company B documents/chunks/storage/conversations; an admin must not read another employee's conversations; self role/company updates must fail; doc ACL/activation changes must revoke access; previous citations must disappear after revocation; verify Arabic/English questions, no-evidence refusal, timeout/quota errors, document duplicate/empty failure and retry/deletion. A local SQL suite is evidence of policy implementation, not a substitute for these real gateway checks.
