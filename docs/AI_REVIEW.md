# MASAR AI path review and fixes

Scope: `feat/public-llama-demo`, starting at `6c5bbd4`. This review changes code and tests, not hosted configuration, documents, subscriptions or secrets. No main merge or production deployment.

## Findings reproduced from the code

1. **Rerank identity validation conflated different failures.** `set(returned_ids) != set(candidate_ids)` rejected a valid relevant subset just like an invented ID. The model was asked to echo every candidate and long corpus IDs, with a free-form placeholder example. This is a reproducible false rejection, not proof that the historical live request omitted IDs: its raw result and new diagnostics are unavailable here.
2. **RRF truncation could discard a branch leader.** Seven shared high-fusion candidates plus distinct semantic/lexical leaders can push one leader outside the eight-candidate cutoff. A regression fixture reproduces this tie/candidate-pool issue.
3. **Protected conversation history was unused.** The API authorized conversation ownership and persisted turns, but embedded/searched the new short message alone and passed no stored history to the answer generator.
4. **The Vercel proxy erased actionable errors.** Known Backend errors became an undifferentiated 502. Unknown response content must remain private, but safe error codes need not be hidden.
5. **The UI accepted model provenance with an empty source array.** The normal Backend rejects this, but the UI boundary could still label a malformed response as verified.
6. **Whitespace-only rewritten queries were accepted by the length-only schema.** They failed later as embedding errors instead of stopping at the rewrite boundary.

7. **Root INFO logging enabled third-party request URL logs.** The installed HTTP client logs request URLs at INFO; those paths/queries can contain private document metadata even when application log statements are sanitized.

## Implemented fixes

- Rerank candidates get request-local `C1..Cn` references, bound in a server-owned map to the original corpus indices. The prompt includes the exact allowed-ID enum and strict response schema. These references are independent of final answer `S1:E1` evidence IDs.
- The protocol explicitly permits a unique subset. Omitted candidates are excluded, not silently treated as relevant. Unknown or duplicate IDs still fail with `AI_SEARCH_INVALID`; scores/relevance remain required and final evidence validation remains unchanged. Logs contain only unknown/duplicate/omitted counts, never model values or documents.
- RRF reserves the top two candidates of each nonempty branch before filling the eight-candidate pool from fusion order. Final ordering still uses validated model relevance, scores and deterministic tie-breaking.
- Authenticated history is loaded only after ownership checks, filtered by company/conversation and bounded to ten turns. Client-supplied history is ignored in this protected path. Hybrid follow-up retrieval uses the shared Llama query rewriter; lexical diagnostic confirmations use the preceding server-stored user topic. Current original question and authorized evidence still reach the answer generator.
- The proxy retains allowlisted Backend error codes/statuses using locally defined safe messages. It never forwards arbitrary upstream messages, URLs, headers or bodies.
- The UI rejects `answered` without any source. Rewrite queries are stripped and validated before spending embedding calls. No fallback responder or fabricated evidence is added.
- The grounded-answer prompt explicitly limits partial-workflow answers to the coverage of supplied evidence.
- Runtime INFO logging is limited to the audited app namespace; HTTP client/transport loggers are set to WARNING, retaining safe app diagnostics without request URL/header logging.

## Corpus, ingestion and permissions inspected

- Demo has **four packaged documents and twelve passages**. Every passage points to an existing Markdown file. The largest title/section/text embedding input is **743 characters**, so the current 2400-character cap truncates none of this corpus.
- The employee handbook documents device requests/setup, working hours/communication and information security. It is **not a comprehensive first-day onboarding plan**. No HR induction/checklist/training workflow is invented or added. The thirteen UI documents are not falsely presented as all being indexed by this Demo corpus.
- Demo source links resolve to actual packaged documents through the local/Vercel proxies. Exact quotes are sliced from original retrieved passages.
- Ingestion/extraction retain bounded upload/archive/PDF limits, UTF-8 binary subprocess transport, original page metadata, chunk IDs, content hashes, batch embedding validation and processing leases. No document, chunker, worker, data or migration is modified without a reproduced defect requiring it.
- The protected path retains JWT validation through Supabase, active company membership, scoped conversations and authenticated `security invoker` search RPCs. Repository migrations enable/force RLS. Regression tests cover denial before history/search access and preservation of authorized chunk/page/quote metadata. **Hosted RLS/database state was not queried or changed.**
- Backend JSON stays UTF-8; the review adds no encoding repairs or text substitutions. The browser still posts to the actual API by default. Existing explicit offline-showcase regression tests are separate from live AI mode, and no error activates that showcase.

## Verification and its limits

Recorded local results: **192 Backend tests**, **39 frontend unit tests**, **10 proxy tests**, and **39 browser cases** (30 workspace/routing/accessibility, 6 live-mode API contracts with declared fixtures, 3 actual local Vite/FastAPI checks without configured inference). Build, Typecheck, frontend Lint/Format and Backend Ruff/Format passed. The only routine runner warning concerned terminal color variables. Backend suite includes existing Cloudflare transport failures, malformed JSON/schema, invalid IDs/quotes/numbers, Arabic/English, greetings, context, ingestion and auth tests, plus the new review regressions. Frontend checks include Build, Typecheck, Lint, Format, adapter/proxy tests, source UI contracts, actual local FastAPI/Vite wiring and cross-viewport route/accessibility checks.

Offline model/vector fixtures verify mechanics, not real semantic accuracy. The extended real-only evaluator covers the requested onboarding variants (including an ambiguous short query with actual prior answers), leave policy, `نعم`/`إيه`/`أكيد`, greetings and out-of-corpus refusal. It uses real Cloudflare clients and no canned answer provider:

```sh
cd backend
uv run --frozen --no-dev python -m scripts.evaluate_semantic --run-live --extended
```

Here it stopped before requests: Backend `.env` is absent; account ID/token and Free-plan confirmation are unavailable; the default 20-attempt budget is below the extended suite's explicit 60-attempt prerequisite. No secret value is printed and no setting is raised automatically. The base evaluator retains its 40-attempt prerequisite. Configure private variables only in the local ignored Backend environment or supported secret settings, never chat/Frontend/Git. Existing account permission for both Llama and BGE-M3 and allowed HTTPS egress to `api.cloudflare.com` are required. No additional account, subscription or Supabase migration is needed.

The warm semantic pipeline still normally makes four provider calls, with two additional cold corpus-embedding calls. Rate/budget guards and HTTP timeouts remain; slow providers or insufficient quota can fail explicitly. Corpus vectors are process-local and package passages are cached; restart is needed to load edited package files. Threshold tuning, end-to-end live latency and live resolution of the historical incident cannot be asserted without credentials and actual requests.

## Next local step

Pull the Demo branch, provide the existing Cloudflare configuration securely, select hybrid retrieval, and explicitly choose a budget appropriate to the acceptance run. Run the command above, then start Backend with `uv run --frozen --no-dev python -m scripts.start_server` and Frontend with `npm run dev`. Vite connects `/api/demo/ask` to `/api/v1/demo/ask`; no Vercel or Render is needed for this local acceptance. Never use a production environment or restart merely to bypass provider quotas.
