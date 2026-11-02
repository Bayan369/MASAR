# MASAR demo MVP — deadline scope

Statuses: [ ] not started; [~] in progress; [x] verified complete; [!] blocked.

Approved scope: four explicitly fictional company documents, real local BM25 retrieval, FastAPI → Cloudflare Workers AI Llama → existing Arabic RTL UI, original-source citations. No uploads, hosted SQL, migrations, authentication or database integration. User now authorizes an MVP-only commit/push; merging remains prohibited. Database Foundation files must remain byte-for-byte unchanged.

- [x] Inspect current UI/backend and capture Database Foundation file hashes outside Git.
- [x] Save api.cloudflare.com as the only additional custom network hostname, preserving Supabase and package-manager restrictions. Draft saved; activation not yet verified.
- [x] Verify model identifier and free allocation against official Cloudflare pricing source: @cf/meta/llama-3.1-8b-instruct-fp8-fast.
- [x] Add four explicitly labelled demo documents (12 sections) and bilingual BM25 retrieval — retrieval tests passed.
- [x] Implement configurable, fail-closed Cloudflare adapter and source/quote/number validation — offline protocol tests passed; this does not claim hosted inference works.
- [x] Connect question UI and original-document reader to real backend; loading/error/source rendering verified in browser contracts, and real local unsupported/missing-configuration paths verified without mocks.
- [x] Add tests and docs: 25 backend tests, 20 frontend unit tests and all 18 desktop/mobile/tablet browser tests passed. Ruff, ESLint, Prettier, TypeScript, build and git diff checks passed. Separate opt-in live test parsed/listed only; never executed. See docs/MVP_DEMO.md.
- [!] Real Llama end-to-end verification requires backend/.env credentials, confirmation of a Workers Free account, and active api.cloudflare.com access. No simulated integration will count as live verification.
- [x] Recheck original nine Database Foundation files against pre-MVP SHA-256 hashes — unchanged. No hosted SQL, commit, push or merge.

Current external blocker: backend/.env exists with empty Account ID/API Token. User confirmed Workers Free Active; MASAR_CLOUDFLARE_FREE_PLAN_CONFIRMED was set to true in the ignored backend/.env. Runtime network policy still excludes api.cloudflare.com; only the draft includes it. The real browser-to-Llama scenario remains UNVERIFIED pending user configuration/activation. No Cloudflare inference request has been made.

Free-only rule: do not enable billing, prepaid AI Gateway or a paid fallback. On a provider connection/auth/quota error, halt further provider calls for this process and report the issue. Configuration confirmation is not a billing-account audit; user must verify the account is on Workers Free before enabling inference.

## MVP-only Git delivery

- [x] Re-run checks: 25 backend tests, 20 frontend unit tests, 18 browser tests, build, lint, type and formatting checks passed. Explicit staging excludes all nine Database Foundation files and its README/ROADMAP hunks.
- [x] Commit and push MVP-only implementation to origin/feat/phase-1-foundation — 622cb2b5f257dd884bb8bd905fd14032c794499a was pushed and independently matched GitHub. All 32 files were explicitly selected; the nine Database Foundation files and shared documentation hunks were excluded. Main remained f8b9bac.
- [!] Live Llama acceptance remains blocked by empty backend credentials and inactive Cloudflare allowlist; do not call the project complete.

## Cloudflare response investigation (uncommitted)

- [x] Inspect adapter and confirm generic parsing failures permanently latched all later requests into AI_HALTED; 200 can also be local refusal, not a successful provider call.
- [x] Add bounded JSON/compression parsing, explicit shape checks and content-free diagnostics; transport-format errors no longer latch the process, while connection/auth/quota/API errors still halt. Invalid generated answers return explicit 502, not a hidden 200 fallback.
- [x] Verify response variants, compression, bounded reads, HTTP/API errors, timeout/quota halting and logging redaction — all 61 backend tests passed (including 36 new transport/diagnostic cases); 20 frontend unit tests, all 18 browser tests, build, lint/type/format checks passed.
- [!] Exact live payload causing the user's failure is not available in this workspace; backend credentials are empty. Do not claim a specific live response mismatch without the new safe diagnostic reason.
- [x] Verify Database Foundation untouched against all nine baseline SHA-256 hashes; no commit/push/merge, hosted SQL or live inference performed.

## Bilingual VPN evidence fix (uncommitted)

- [x] Reproduce retrieval for the exact English VPN question: all three VPN sections are returned, setup originally ranked third. No evidence that source text was missing; the specific rejected model quote was not retained.
- [x] Replace generated quote copying with source-bound evidence IDs and exact server-side text extraction from the same prompt bank; invented/cross-source references and generated quote fields are rejected.
- [x] Verify with 83 passing backend tests (22 new bilingual/evidence cases), 18 passing browser regression tests and Ruff checks. English connect/setup aliases now rank the requested VPN setup section first. No live Llama replay was performed.
- [x] Recheck all nine Database Foundation file hashes unchanged; no Supabase configuration changes, hosted requests/SQL, commit or push.
