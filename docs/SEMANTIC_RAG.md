# Semantic RAG for the MASAR Demo

## Scope and reused services

The active anonymous Demo now honors `MASAR_RETRIEVAL_MODE=hybrid` (the existing default). This is a real inference path, not a lookup table or a collection of expected questions. It reuses the existing Cloudflare Workers AI Llama model, BGE-M3 embedding client (1024 dimensions, multilingual Arabic/English), packaged RAG passages, source/evidence validator and conversation transport. No dependency, paid model, subscription, database migration or external service is added.

The authenticated company-document path retains the existing Supabase/pgvector `search_chunks` RPC and tenant/access-control checks. No hosted Supabase data, settings or migration is changed. The new local vector index is specifically for the small existing Demo corpus (12 passages across four Markdown documents), not a replacement for the protected company database or the 13 UI documents.

## Active Demo pipeline

1. Recognize social greetings without pretending they are grounded knowledge. Pure greetings make no AI calls.
2. Llama rewrites the current question plus bounded conversation history into a standalone query. The prompt asks it to preserve Saudi dialect intent, entities and uncertainty without answering. A strict JSON schema rejects invalid rewrites.
3. BGE-M3 embeds the corpus in batches of at most eight, and embeds both original and rewritten questions in one query batch. Keeping the original query reduces dependence on a potentially imperfect rewrite.
4. Exact cosine vector search over normalized vectors runs in Python RAM. This is exhaustive vector search, appropriate for 12 passages, not ANN or a hosted vector database.
5. An independent BM25 keyword ranker uses Unicode normalization and stop words, with **no domain synonym table**. Reciprocal-rank fusion merges its ranking and semantic ranking (`1/(60 + rank)`), preserving each branch’s top two candidates in the capped pool. The existing hand-maintained alias matcher is retained only for the explicit lexical diagnostic mode.
6. Llama reranks up to eight fused candidates against the original intent and history. The model receives request-scoped `C1..Cn` IDs and their exact schema enum; the server maps these to original passages. A unique relevant subset is valid and omitted candidates are excluded. Unknown or duplicated IDs are rejected. Relevance and score thresholds filter the final three passages.
7. The existing answer generator receives original question, history and selected evidence. Existing JSON, source ID, evidence ID, exact-quotation and numeric-grounding checks remain. History is untrusted context, never an evidence source. No relevant evidence yields `not_found`; provider/embedding/rewrite/rerank errors return explicit errors, without synthetic answers or a silent lexical fallback.

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
