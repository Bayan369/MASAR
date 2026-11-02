# Cloudflare Workers AI — response diagnosis

No hosted replay was performed for this investigation: Account ID/token in the Codex backend configuration were empty. The user's successful PowerShell `OK` proves their simple inference request works, not that a longer question/context request returned the same representation or valid MASAR answer JSON.

## Confirmed defects in the previous code

- A single broad ValueError/TypeError/AttributeError branch collapsed invalid HTTP JSON, missing success/result/response fields, empty model output and other schema errors into AI_PROVIDER_RESPONSE_INVALID, without diagnostic detail.
- That branch set `_halted=True`; every later relevant question returned AI_HALTED/503 without another Cloudflare request, even if the initial failure was a recoverable representation error.
- `read(100_000)` silently cut a larger JSON body and could create a parsing error from a valid response. A regression fixture demonstrates this; it does not prove the user's actual response exceeded that limit.
- The transport required `success is True` and a string `result.response`. Native response objects, omitted success flags and structured answer objects were not accepted. The documented REST success envelope with a text response already worked; there is no evidence to claim that exact envelope was inherently incompatible.
- Invalid generated JSON/citations were previously converted to a 200 not_found, hiding generation/validation failures among genuine no-context refusals.

The exact **first failing live response** is still unknown. New logs identify it safely instead of guessing that credentials, gzip or a particular field were the cause.

## Current behavior

- POST to the same fixed native REST endpoint, same selected Llama model, `messages`, `stream:false`, maximum 600 output tokens and 35-second timeout. Explicit Accept JSON / identity encoding; compression decoding remains defensive.
- Bounded 1MB wire AND decoded sizes; detect oversize instead of silently truncating. Decode gzip/deflate, including a gzip signature when a server omits the encoding header. Reject HTML, unexpected SSE, empty bodies, malformed JSON and invalid response shapes explicitly.
- Accept REST `{success:true,result:{response:"…"}}`, compatible `{result:{response:"…"}}`, and native `{response:"…"}` objects. A structured `response` containing the required answer fields is serialized as actual JSON. Arbitrary root strings/objects are not treated as generated answers. Explicit `success:false` or API errors are never accepted as success.
- A transport representation failure returns 502 without permanently latching the provider. There is **no automatic retry**; the local attempt budget still counts it.
- HTTP 401/403, 402/429, other upstream HTTP/API errors and connection/timeouts still halt this process. A later AI_HALTED log includes the original safe error code. Restart only after diagnosis; never restart as a free-quota workaround.
- Retry-After seconds are logged if supplied as a bounded integer. No automatic backoff/retry or paid fallback occurs.
- No context or an explicit supported=false remains 200/not_found. Invalid generated answer JSON/schema/evidence now returns 502/AI_ANSWER_INVALID, not a fake "information missing" response. Markdown JSON fences with or without a `json` label are supported.

## Safe log events

Failure warnings appear without enabling DEBUG:

```text
workers_ai_failure code=AI_PROVIDER_RESPONSE_INVALID reason=empty_model_response http_status=200 api_codes=none halted=False attempt=1
workers_ai_http_error http_status=429 api_codes=… retry_after_seconds=15
workers_ai_blocked original_code=AI_QUOTA_OR_RATE_LIMIT attempt=1
llama_answer_rejected reason=json_or_answer_schema_invalid
```

These are **format examples**, not observations of the user's live request. Real numeric API error codes are recorded, but the remote free-text error message is never logged.

Informational events `workers_ai_body` and `workers_ai_success` include only normalized MIME/encoding labels, byte/character counts, recognized envelope shape, status and elapsed time. Enable the application logger at INFO via your Python logging configuration if needed; Uvicorn's access-log level alone may not configure application loggers. Do not enable HTTP wire/header logging or raw payload dumps.

No Account ID, URL with account path, API token, Authorization header, question, prompt, source passage, generated answer, error-body preview or raw exception/ValidationError is logged by these diagnostics. Tests assert redaction against sensitive sentinel values.

Common reasons:

| Reason | Meaning / next check |
| --- | --- |
| empty_http_body / empty_model_response | HTTP body or actual response text is empty; distinguish from a working short PowerShell prompt |
| malformed_json / html_instead_of_json / unexpected_sse | The transport returned a different body type; inspect safe Content-Type/encoding metadata |
| result_not_object / response_not_text_or_answer_object | Envelope/field type mismatch; no content is printed |
| api_error_envelope | Cloudflare returned explicit errors, possibly with HTTP 200; inspect numeric API code |
| proxy_tunnel_rejected / tls_verification_or_handshake / timeout | Network layer, not generated-answer JSON; preserve proxy/TLS controls |
| json_or_answer_schema_invalid | Transport succeeded but Llama text is not the required structured answer |
| quote_not_in_retrieved_source / answer_numbers_not_in_evidence | Generated answer failed groundedness checks; no replacement answer is fabricated |

After installing the reviewed local changes, restart the backend once to discard the old process's latched state. Ask one question and inspect the first `workers_ai_failure` or `llama_answer_rejected` line. Share only that safe diagnostic line if the issue persists, never .env or the token. Stop live testing on connection/access/quota errors. No live request or billing change is part of this offline repair.
