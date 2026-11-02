# MASAR demo MVP — real retrieval, opt-in hosted Llama

This is a deadline-specific demo path, not completion of the seven-phase production roadmap. Existing Database Foundation migrations/design are preserved and remain unapplied to hosted Supabase. No uploads, document ingestion, login, database-backed records, persistent history or deployment are added.

## Actual data flow

1. The Arabic RTL question UI POSTs `{question}` to FastAPI `/api/v1/assistant/ask`.
2. FastAPI searches 12 sections from four packaged **fictional demo-company** Markdown documents using deterministic BM25. The index includes content, titles and section headings; transparent Arabic normalization and bilingual term aliases support queries containing VPN, MFA, IT and HR. No embeddings or external retrieval service is used.
3. If retrieval has no adequate lexical overlap, return `not_found` without inference.
4. Otherwise send only the question and top three passages to Cloudflare Workers AI. This is real hosted inference when correctly configured, not a canned answer. Fixed demo documents are explicitly labelled; they are not real corporate policies or employee data.
5. Parse Llama's structured answer and source-qualified evidence IDs. The server extracts exact quotes from the same retrieved evidence bank; Llama never generates quotes. Reject invented/cross-source IDs and numeric additions absent from evidence. Unsupported questions return not_found; malformed/invalid-source outputs return an explicit error, never a fabricated fallback. See [bilingual evidence design](CITATION_EVIDENCE.md).
6. Display the Arabic answer, source title/section, verbatim evidence and expandable original passage. Source links open the corresponding full demo document in Knowledge Base.

Documents: Employee Handbook, Leave Policy, IT Support Guide and VPN Setup Guide. Contents are approved fictional demo material, not seeded database records.

## Model choice and official references

Default: `@cf/meta/llama-3.1-8b-instruct-fp8-fast`. Chosen for a small, bounded demo request cost relative to the 70B variant; Arabic answer quality must still be checked with actual inference. Configurable alternative: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Other IDs are rejected until reviewed; no automatic fallback occurs.

Model IDs and free allocation were verified against Cloudflare's official pricing source on 2026-11-02:

- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/workers-ai/platform/pricing.mdx
- https://developers.cloudflare.com/workers-ai/get-started/rest-api/

The documented default rates are 4,119 neurons per million input tokens and 34,868 per million output tokens. The documented free allocation is 10,000 neurons/day; **Workers Paid may incur automatic overage charges**. This application cannot audit a Cloudflare account's billing plan or usage by other clients.

## Required configuration — no secrets in chat or frontend

Edit ignored **backend/.env** locally:

```dotenv
MASAR_CLOUDFLARE_ACCOUNT_ID=
MASAR_CLOUDFLARE_API_TOKEN=
MASAR_CLOUDFLARE_MODEL=@cf/meta/llama-3.1-8b-instruct-fp8-fast
MASAR_CLOUDFLARE_FREE_PLAN_CONFIRMED=false
```

Create a token through Cloudflare Workers AI → Use REST API → Create a Workers AI API Token, scoped to the intended account. Cloudflare's REST guide says manually created tokens require Workers AI Read and Edit. Never use a global API key or place the token in a VITE_ variable. Account IDs are 32 hexadecimal characters. Secrets are read only on the server and errors do not include them.

**Before setting confirmation to true, verify the account is actually on Workers Free. Do not set true for a Paid account simply because it has free daily allocation. Do not enable billing, AI Gateway credits or a paid fallback.** Leave confirmation false if uncertain; inference stays blocked. The confirmation flag is an operator prerequisite, not a technical guarantee of account billing state. Cloudflare's actual Workers Free limits enforce the account-wide cap.

Allow outbound HTTPS to `api.cloudflare.com` through environment settings. A draft domain addition was saved; saving a draft does not activate/publish it. Verify the active runtime policy before live testing. No broad Internet access is needed. No Workers deployment or account/billing change is performed by this code.

Additional local controls: one inference in flight, at most 20 attempts per backend process, at most 600 output tokens per call, 35-second provider timeout, no automatic retries. Any network, authorization, upstream HTTP/API or quota error stops further provider calls in that process. A malformed HTTP-success response fails explicitly with 502 but no longer permanently blocks later manual requests; there are no automatic retries. Invalid generated JSON/evidence also returns an explicit 502 rather than a false not-found answer. See [safe response diagnostics](CLOUDFLARE_DIAGNOSTICS.md). Investigate before an explicit restart; restarting resets the local counter and is not a quota/billing workaround.

## Start locally

Terminal 1:

```sh
cd backend
uv sync --frozen --extra dev
uv run --frozen uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```sh
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

The browser must reach the backend. Defaults use port 8000 and frontend port 5173; configure the public `VITE_API_BASE_URL` and explicit backend CORS origins only if using different browser-reachable origins. Restart the backend after changing backend/.env. Do not expose this unauthenticated demo publicly or enter confidential/personal information.

## Offline tests (no Cloudflare inference)

```sh
cd backend
.venv/bin/pytest
.venv/bin/ruff check app tests scripts
.venv/bin/ruff format --check app tests scripts

cd ../frontend
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
```

Normal browser tests start a real local FastAPI server with free-plan confirmation forcibly false, so they cannot consume live inference. UI-answer and provider-transport tests use clearly labelled synthetic responses for contract checks only. Document fetching/retrieval are real local code. Passing offline tests is **not** evidence of a working Cloudflare integration.

## One-call real verification — separate explicit opt-in

After configuring an actual Free account and verifying active network access, choose **one** option first. Both consume a real inference and have no retry:

A. With the local backend already running:

```sh
cd backend
python scripts/smoke_mvp.py --allow-live-inference
```

This first checks an out-of-scope question, which must refuse without inference. It then asks about annual leave once and requires an actual Llama-labelled answer with Leave Policy evidence. It prints only the demo answer/model/source, never credentials.

B. Complete browser journey (stop existing servers on 5173/8000 first; this command starts its own):

```sh
cd frontend
MASAR_RUN_LIVE_AI=true npm run test:e2e:live
```

No route mocks are used in this opt-in test. It asks one annual-leave question through the UI, checks the actual response and citation, opens the original document, and captures `/tmp/masar-mvp-live.png`. This file is not generated unless the live test reaches that step. Do not run both checks unnecessarily or repeat after a provider failure; report it and stop. Live verification status is recorded in MVP_PROGRESS.md.

## Manual demonstration

- Ask: «كم يوم الإجازة السنوية في الشركة التجريبية؟» → document-supported answer should state 21 working days and cite Leave Policy.
- Ask: «كيف أطلب إجازة سنوية؟» → manager request at least five working days ahead, then HR confirmation.
- Ask: «كيف أطلب صلاحية VPN؟» → IT request including manager approval; cite VPN Setup Guide.
- Ask: «ما راتب الرئيس التنفيذي؟» → no supported information; no invented salary.
- Open a source link and read the original demo policy.

These are acceptance expectations, not recorded live results until an actual hosted run passes.

## Limitations

BM25 is lexical, not vector/semantic retrieval, and may miss paraphrases. Exact quote/source and number validation reduce unsupported output but do not prove every generated paraphrase is entailed; manual groundedness checks remain necessary. No private-company data or real employee records are used. No Auth, uploads, persistence, account provisioning, billing controls or Supabase migrations are enabled. Database Foundation remains a separate review draft.
