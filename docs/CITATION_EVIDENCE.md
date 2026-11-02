# Bilingual VPN citation repair — not a live-inference result

## Reproduced facts

For `How do I connect to the company VPN?`, the original BM25 tokens were `connect` and `vpn`. Retrieval returned the three real VPN sections in this order: access request, troubleshooting, setup. Thus setup text was present; it was not removed by chunking. The demo Markdown has Arabic and English text inside each section.

`quote_not_in_retrieved_source` proves that the model's quote was not a whitespace-normalized substring of the specific source it cited. The log does not retain the rejected text, so it cannot prove whether that individual quote was paraphrased, translated, punctuation-altered or attached to the wrong source. No credentials are configured for a live replay here.

The design weakness was asking a generative model to reproduce exact bilingual text while generating an Arabic answer to an English question. Prompt instructions alone cannot guarantee byte-identical quotations. The repair removes quote generation rather than weakening matching or accepting fabricated evidence.

## New internal Llama contract

Every retrieved section gets a request-local source ID. Its exact text is split into Arabic/English sentence/newline spans with offsets and source-qualified IDs:

```json
{
  "source_id": "S1",
  "evidence": [
    {"evidence_id": "S1:E1", "text": "Original text supplied by the backend"}
  ]
}
```

This is a schema illustration, not a company policy or runtime response. The actual bank is always built from the retrieved document text and reused for prompt construction and validation.

Llama generates its answer and chooses existing IDs:

```json
{
  "supported": true,
  "answer": "Model-generated answer",
  "citations": [{"source_id": "S1", "evidence_ids": ["S1:E1"]}]
}
```

No `quote` field is permitted in model output. The server validates source membership, evidence membership, duplicates and counts, then slices the exact original text using the stored offsets. Adjacent selected spans may form one contiguous quote with original spacing/punctuation; nonadjacent spans become separate source entries. The public API still returns `sources[].quote`, `.excerpt`, `.title`, `.section` and `.document_id`, so no frontend contract change is needed. Source IDs now identify individual quote ranges, which the frontend treats as opaque IDs.

Invented IDs, cross-source references, legacy/generated quote fields, empty evidence and duplicates fail explicitly with `AI_ANSWER_INVALID`. There is no fuzzy matching, quote translation, silent repair, model retry or canned-answer fallback. The final quote must be an exact substring of its own source; existing numeric evidence checks remain.

## Bilingual behavior and retrieval

Arabic remains the default answer language even for English questions. An explicit request for English is allowed. The answer may be paraphrased/translated, but selected evidence stays in its original language, independent of the answer language.

Transparent BM25 aliases map `connect`/`connecting` and the corresponding Arabic connect verbs to the existing setup concept. The exact English question and its Arabic counterpart now rank `vpn-setup-guide:2` first. No fixed VPN answer or keyword-to-answer lookup was added; the same real retrieval and Llama path remains.

## Verified offline checks

- Exact English question, Arabic question, and explicit English-answer requests.
- Arabic and English original evidence selected independently of answer language.
- Fabricated quote fields/IDs, translated quote fields and cross-source IDs rejected.
- Duplicate/empty references rejected.
- Evidence offsets cover all 12 bilingual sections without losing non-whitespace text.
- Nonadjacent statements are never spliced into a false contiguous quote.
- Adjacent statements preserve original whitespace; decimal numbers are not split at decimal dots.

Test model responses are local protocol fixtures only. They are not production responses and do not establish that hosted Llama followed the new prompt. Real acceptance still requires one configured live question on Workers Free. Database Foundation, Supabase configuration, document contents and the Cloudflare transport remain unchanged by this repair.
