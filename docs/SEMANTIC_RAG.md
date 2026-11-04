# Semantic RAG for the MASAR Demo

## Scope and reused services

The active anonymous Demo now honors `MASAR_RETRIEVAL_MODE=hybrid` (the existing default). This is a real inference path, not a lookup table or a collection of expected questions. It reuses the existing Cloudflare Workers AI Llama model, BGE-M3 embedding client (1024 dimensions, multilingual Arabic/English), packaged RAG passages, source/evidence validator and conversation transport. No dependency, paid model, subscription, database migration or external service is added.

The authenticated company-document path retains the existing Supabase/pgvector `search_chunks` RPC and tenant/access-control checks. No hosted Supabase data, settings or migration is changed. The new local vector index is specifically for the small existing Demo corpus (12 passages across four Markdown documents), not a replacement for the protected company database or the 13 UI documents.

## Active Demo pipeline

1. Recognize social greetings without pretending they are grounded knowledge. Pure greetings make no AI calls.
2. The same existing Llama rewrite call returns a standalone query plus a structured intent (request/scope/conditions). Original question and bounded history remain authoritative. Conditions are `confirmed`, `denied` or `unknown`; confirmed/denied conditions require a valid sentence ID from actual USER turns. Assistant turns resolve offers but cannot prove prerequisites. Missing prerequisites are unknown, never implicitly true. The summary and entailment are model judgments, not deterministic proofs.
3. BGE-M3 embeds the corpus in batches of at most eight, and embeds both original and rewritten questions in one query batch. Keeping the original query reduces dependence on a potentially imperfect rewrite.
4. Exact cosine vector search over normalized vectors runs in Python RAM. This is exhaustive vector search, appropriate for 12 passages, not ANN or a hosted vector database.
5. An independent BM25 keyword ranker uses Unicode normalization and stop words, with **no domain synonym table**. Reciprocal-rank fusion merges its ranking and semantic ranking (`1/(60 + rank)`), preserving each branch’s top two candidates in the capped pool. The existing hand-maintained alias matcher is retained only for the explicit lexical diagnostic mode.
6. Protocol `intent-evidence-v2` keeps one reranker call for at most eight fused candidates. Every candidate still requires separate `original` and `rewritten` Boolean/finite-score assessments; original additionally requires `relation`, `evidence_ids` (up to two original sentences), and `condition_ids`. Relations are `direct_support`, `partial_support`, `conditional_support`, `background_only`, `no_support`. Candidate completeness, duplicates and unknown IDs fail closed. Sentence references are checked against the exact candidate, not just a global enum; no generated quotation is accepted. Conditions must reference the structured user intent. Conditional evidence is eligible only when a nonempty prerequisite set is all confirmed. Unknown/denied prerequisites and background cannot be rescued by a high score. Partial/direct evidence still requires original `relevant=true` and the unchanged 0.6 threshold; false original judgments are never overridden. Rewritten scores only break original-score ties before RRF. These scores remain uncalibrated.
7. Hybrid hits preserve the original passage and carry exact support sentence offsets and relation. The existing answer call receives only these validated sentence spans, with stable source/evidence mappings. Omitted sentences from the same passage cannot be cited. A partial source is explicitly not a complete checklist; conditional actions must retain their prerequisites. Existing JSON, source ID, evidence ID, exact-quotation and numeric-grounding checks remain. No applicable evidence yields `not_found` without an answer call. Invalid annotations return explicit errors, never a local responder or relaxed-schema fallback.

The authenticated query-rewrite API remains compatible (`rewrite_query` returns a string); lexical and protected hits without support metadata retain their existing behavior. No corpus files, hosted Supabase settings or evaluator expectations change. The extended schema is internal and deliberately rejects old hybrid fixtures/responses missing the required intent or support fields; it does not silently interpret omissions as evidence. Deploy/run the matching backend and tests together.

The generation provider still uses max_tokens=600, temperature=0.1, the same model and budget. Prompts request compact JSON and bounded annotations instead of generated quotations/reasoning. No tokenizer benchmark or live schema compliance is claimed: the richer output may hit the existing output limit. Malformed/truncated output fails closed without retries or extra calls. Local fixtures prove only application policy; Llama can still misinterpret intent, falsely reject useful evidence, or mislabel a prerequisite. Checking an exact sentence proves its source membership, not semantic entailment. Correlated views are not independent corroboration. These residual model-quality limitations cannot be eliminated deterministically within the current one-call reranker constraint.

The rewriter and reranker prompts are general, not per-question translations or dialect phrase mappings. A model-assisted rewrite/rerank is not an absolute guarantee of semantic correctness; live evaluation and relevance tuning are required on the actual corpus.

## Index lifecycle and cost

The process builds the index lazily, caches it in memory, fingerprints the corpus contents, and atomically replaces cached vectors only after all batches validate. Each process owns its cache. Restarting clears it; a changed input corpus invalidates the fingerprint. Packaged passages are cached, so restart to load edited package files. No document/vector files are written or committed.

For 12 passages, the first request requires two corpus-embedding calls. A warm answered question normally uses four calls: rewrite, query embedding, rerank and final answer. An evidence-free question may skip the final answer. All calls share the existing Workers Free confirmation, request budget and failure latch. The default `MASAR_AI_CALL_BUDGET=20` can therefore exhaust after a few questions; it is not a billing cap. There are no automatic retries. Do not restart simply to bypass quotas.

The HTTP/UI/proxy timeouts are unchanged. Cold indexing plus several model calls increases latency; a slow provider can time out. The implementation does not claim production-scale latency, shared indexing or distributed rate limiting.

## Configuration

All settings remain Backend-only; never put Cloudflare values in `VITE_` variables.

- Existing `MASAR_CLOUDFLARE_ACCOUNT_ID`, `MASAR_CLOUDFLARE_API_TOKEN`, `MASAR_CLOUDFLARE_FREE_PLAN_CONFIRMED` and model settings must be valid for the existing account. The token must authorize both Llama inference and BGE-M3 inference; real availability and Workers Free quota must be checked in that account.
- `MASAR_RETRIEVAL_MODE=hybrid`: enables the complete Demo pipeline. `lexical` explicitly selects the old diagnostic path; errors never select it automatically.
- `MASAR_SEMANTIC_MIN_SIMILARITY=0.35`: cosine candidate floor, configurable 0..1.
- `MASAR_RERANK_MIN_SCORE=0.6`: final relevance floor, configurable 0..1. These are initial settings, not calibrated quality guarantees.
- Existing `MASAR_AI_CALL_BUDGET`, Demo rate limits, CORS and environment isolation still apply. No new credential is required.

Backend egress must permit `api.cloudflare.com` with working TLS verification. No network policy, account, subscription or secret is changed by this implementation.

## Original-source links

Demo answer sources now include a relative URL to the actual packaged Markdown. The frontend keeps these URLs and renders them with the existing source-link style. Vite and the Vercel API proxy map them to `/api/v1/demo/documents/{document_id}`. The Backend serves only IDs already present in the RAG corpus, with UTF-8 text; arbitrary paths cannot be read. Links do not point to an unrelated frontend document having a similar title.

## Tests versus real acceptance

`tests/test_semantic_search.py` uses explicitly synthetic embeddings and model JSON to verify vector math, batching/cache, hybrid ranking, strict candidate IDs, context, failures, greetings, source links and actual API wiring. These tests **do not prove language understanding or a live Cloudflare call**.

A separate opt-in, real-only acceptance runner exists:

```sh
cd backend
uv run --frozen --no-dev python -m scripts.evaluate_semantic --run-live
```

It requires existing credentials, Workers Free confirmation, hybrid mode and an operator-configured call budget of at least 40 for the complete evaluation (roughly 33 calls). It never changes settings itself. It exits before requests if prerequisites are missing. It tests the five requested onboarding phrasings, leave policy, contextual continuation, greetings and an unrelated question. Add `--extended` for the ambiguous short onboarding query and the three short confirmations with real prior answers; the extended suite requires an explicit budget of at least 60. It checks actual model provenance, original-document evidence and exact quotations; it prints statuses/document IDs, not tokens, account IDs, raw model text or document contents. The corpus only documents the onboarding procedures it actually contains; the model must not invent additional first-day steps.

No live success is asserted until this runner and the actual UI pass with configured Cloudflare. No production deployment is part of this change.

## Pinpointing an evidence-selection acceptance failure

Three successful `status=answered documents=employee-handbook` lines before `Expected evidence not selected` identify the fourth base onboarding case: `What should I do on my first day?`. Its unchanged expected evidence is `employee-handbook`, section containing `Onboarding` (currently `employee-handbook:1`). Earlier successful lines do not identify what the failed case selected.

The evaluator now prints a case index before each request. On an evidence mismatch, it prints metadata-only `case_trace` records for vector scores/ranks, keyword ranks, RRF selection, validated rerank references mapped to actual passage IDs, answer candidates and final cited passage IDs. Rewritten text is hashed; questions, prompts, answers, quotes, documents and credentials are never dumped. The default API does not collect this trace. Trace collection changes neither search results nor model-call count, and the original evidence assertions remain unchanged.

An explicitly scoped diagnostic run can execute the fourth case only:

```sh
uv run --frozen --no-dev python -m scripts.evaluate_semantic --run-live --onboarding-case 4
```

It requires at most six provider attempts for the current twelve-passage cold corpus, checks the existing budget without raising it, and does not claim that the full acceptance suite ran. Do not combine it with `--extended`.

If the expected passage disappears before `answer_candidates`, inspect the first stage that excluded it. If it is present there but absent from `answer_sources`, investigate answer/evidence selection rather than retuning embeddings. Offline regression fixtures demonstrate this latter possibility, but are **not a replay or diagnosis of the user's live response**. No relevance weights, thresholds or acceptance expectations are changed without actual stage data.

The response schema fixes the assessment count to the supplied candidate count. No score threshold is changed: `MASAR_RERANK_MIN_SCORE` remains 0.6. Complete all-negative assessments can yield `not_found`; incomplete assessments cannot. No special handling for any acceptance case or document is used.
