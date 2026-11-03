"""Bounded Cloudflare REST transport with content-free diagnostic logging."""

import gzip
from http.client import IncompleteRead
from io import BytesIO
import json
import logging
import math
import re
import ssl
from threading import Lock
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import zlib

from app.config import Settings

logger = logging.getLogger(__name__)
MAX_RESPONSE_BYTES = 1_000_000
SUPPORTED_MODELS = {
    "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
}


class AIUnavailable(Exception):
    def __init__(self, code: str, message: str, status: int = 503):
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


class ResponseFormatError(Exception):
    """Reason is a fixed local label, NEVER a remote message or response body."""


def api_error_codes(data: object) -> str:
    if not isinstance(data, dict) or not isinstance(data.get("errors"), list):
        return "none"
    codes = []
    for item in data["errors"][:8]:
        code = item.get("code") if isinstance(item, dict) else None
        if isinstance(code, (str, int)) and not isinstance(code, bool):
            value = str(code)
            if re.fullmatch(r"[0-9]{1,10}", value):
                codes.append(value)
    return ",".join(codes) or "none"


def read_json_response(response: object) -> tuple[object, dict]:
    headers = getattr(response, "headers", None) or {}
    mime = str(headers.get("Content-Type", "")).split(";", 1)[0].strip().lower()
    mime = (
        mime
        if mime in {"application/json", "text/html", "text/event-stream", "text/plain"}
        else "other"
    )
    encoding = str(headers.get("Content-Encoding", "identity")).strip().lower()
    encoding = encoding if encoding in {"identity", "gzip", "deflate"} else "unsupported"
    diagnostic = {"mime": mime, "encoding": encoding, "bytes": 0}
    body = response.read(MAX_RESPONSE_BYTES + 1)
    if not isinstance(body, bytes):
        raise ResponseFormatError("non_bytes_body")
    diagnostic["bytes"] = len(body)
    # Report safe transport metadata even when JSON/encoding parsing fails.
    logger.info("workers_ai_body mime=%s encoding=%s bytes=%s", mime, encoding, len(body))
    if len(body) > MAX_RESPONSE_BYTES:
        raise ResponseFormatError("response_too_large")
    try:
        if encoding == "gzip" or (encoding == "identity" and body.startswith(b"\x1f\x8b")):
            with gzip.GzipFile(fileobj=BytesIO(body)) as compressed:
                body = compressed.read(MAX_RESPONSE_BYTES + 1)
        elif encoding == "deflate":
            decoder = zlib.decompressobj()
            body = decoder.decompress(body, MAX_RESPONSE_BYTES + 1)
            if len(body) > MAX_RESPONSE_BYTES or decoder.unconsumed_tail:
                raise ResponseFormatError("decoded_response_too_large")
            if not decoder.eof:
                raise ResponseFormatError("invalid_compression")
        elif encoding == "unsupported":
            raise ResponseFormatError("unsupported_encoding")
    except (OSError, EOFError, zlib.error):
        raise ResponseFormatError("invalid_compression") from None
    if len(body) > MAX_RESPONSE_BYTES:
        raise ResponseFormatError("decoded_response_too_large")
    if not body.strip():
        raise ResponseFormatError("empty_http_body")
    try:
        return json.loads(body), diagnostic
    except (ValueError, UnicodeError):
        prefix = body.lstrip()[:16].lower()
        reason = (
            "unexpected_sse"
            if prefix.startswith(b"data:")
            else ("html_instead_of_json" if prefix.startswith(b"<") else "malformed_json")
        )
        raise ResponseFormatError(reason) from None


def extract_model_response(data: object) -> tuple[str, str]:
    """Accept REST envelopes and native response objects, never arbitrary text.

    `success:false` / explicit errors are handled by the caller before extraction.
    JSON-mode native response objects are serialized as JSON, not Python repr.
    """
    if not isinstance(data, dict):
        raise ResponseFormatError("root_not_object")
    if "success" in data and data["success"] is not True:
        raise ResponseFormatError("invalid_success_flag")
    if "result" in data:
        result, shape = data["result"], "rest_envelope"
    elif "response" in data:
        result, shape = data, "native_response"
    else:
        raise ResponseFormatError("missing_result_or_response")
    if not isinstance(result, dict):
        raise ResponseFormatError("result_not_object")
    text = result.get("response")
    if isinstance(text, dict):
        return json.dumps(text, ensure_ascii=False), shape + "_json_object"
    if not isinstance(text, str):
        raise ResponseFormatError("response_not_text_or_answer_object")
    if not text.strip():
        raise ResponseFormatError("empty_model_response")
    return text, shape


def finish_diagnostic(data: object) -> tuple[str, str]:
    """Read optional provider metadata, never infer truncation from text length."""
    result = data.get("result", data) if isinstance(data, dict) else None
    reason = result.get("finish_reason") if isinstance(result, dict) else None
    # Unknown/free-form upstream values must never enter logs.
    allowed = {"stop", "length", "max_tokens", "eos_token", "end_turn", "content_filter"}
    if not isinstance(reason, str) or reason not in allowed:
        return ("unrecognized" if reason is not None else "unavailable"), "unknown"
    truncated = "confirmed" if reason in {"length", "max_tokens"} else "not_reported"
    return reason, truncated


def network_kind(error: Exception) -> str:
    reason = error.reason if isinstance(error, URLError) else error
    if isinstance(reason, (TimeoutError,)):
        return "timeout"
    if isinstance(reason, ssl.SSLError):
        return "tls_verification_or_handshake"
    if isinstance(reason, str) and re.match(r"Tunnel connection failed: [0-9]{3}", reason):
        return "proxy_tunnel_rejected"
    if isinstance(error, IncompleteRead):
        return "incomplete_http_body"
    return "connection_error"


class CloudflareProvider:
    """No automatic retries/fallback. Free-plan and bounded per-process attempt guard remain.

    Connection/auth/quota/upstream API errors latch off until explicit restart.
    A successful HTTP response with malformed representation fails that request
    explicitly; it no longer poisons every subsequent request in the process.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self._lock = Lock()
        self._calls = 0
        self._halted = False
        self._halt_reason: str | None = None

    def fail(
        self,
        code: str,
        message: str,
        *,
        reason: str,
        halt: bool,
        status: int = 503,
        http_status: int | None = None,
        codes: str = "none",
    ):
        if halt:
            self._halted = True
            self._halt_reason = code
        logger.warning(
            "workers_ai_failure code=%s reason=%s http_status=%s api_codes=%s halted=%s attempt=%s",
            code,
            reason,
            http_status,
            codes,
            halt,
            self._calls,
        )
        raise AIUnavailable(code, message, status) from None

    def generate(self, system: str, question: str) -> str:
        return self._invoke(
            {
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": question},
                ],
                "response_format": {"type": "json_object"},
                "max_tokens": 600,
                "temperature": 0.1,
                "stream": False,
            },
            self.settings.cloudflare_model,
        )

    def embed(self, inputs: list[str]) -> list[list[float]]:
        if not 1 <= len(inputs) <= 8 or any(
            not text.strip() or len(text) > 2400 for text in inputs
        ):
            raise AIUnavailable("EMBEDDING_INPUT_INVALID", "حجم مقاطع الفهرسة غير صالح.")
        return self._invoke({"text": inputs}, "@cf/baai/bge-m3", embedding=True)

    def _invoke(self, payload: dict, model: str, embedding: bool = False):
        s = self.settings
        if not s.cloudflare_account_id or not s.cloudflare_api_token.get_secret_value():
            raise AIUnavailable(
                "AI_NOT_CONFIGURED",
                "خدمة Llama غير مهيّأة بعد. يلزم إعداد Cloudflare في الخدمة الخلفية.",
            )
        if not s.cloudflare_free_plan_confirmed:
            raise AIUnavailable(
                "FREE_PLAN_NOT_CONFIRMED",
                "أُوقف الاستدلال حتى تأكيد استخدام خطة Workers Free المجانية.",
            )
        if not re.fullmatch(
            r"[0-9a-fA-F]{32}", s.cloudflare_account_id
        ) or model not in SUPPORTED_MODELS | {"@cf/baai/bge-m3"}:
            raise AIUnavailable(
                "AI_CONFIGURATION_INVALID",
                "إعدادات الحساب أو نموذج Llama غير صالحة. راجع إعدادات الخدمة الخلفية.",
            )
        if not self._lock.acquire(blocking=False):
            raise AIUnavailable("AI_BUSY", "يوجد سؤال قيد المعالجة. انتظر ثم أعد المحاولة.", 429)
        try:
            if self._halted:
                logger.warning(
                    "workers_ai_blocked original_code=%s attempt=%s", self._halt_reason, self._calls
                )
                raise AIUnavailable(
                    "AI_HALTED",
                    "أُوقفت طلبات Llama بعد خطأ اتصال أو وصول أو حد استخدام. راجع سبب workers_ai_failure في سجل الخادم قبل إعادة التشغيل.",
                )
            if self._calls >= s.ai_call_budget:
                self.fail(
                    "AI_BUDGET_REACHED",
                    "وصلت الخدمة إلى حد الطلبات المحلي. أُوقف الاستدلال لحماية الحصة المجانية.",
                    reason="local_attempt_limit",
                    halt=True,
                )
            self._calls += 1
            request = Request(
                "https://api.cloudflare.com/client/v4/accounts/"
                + s.cloudflare_account_id
                + "/ai/run/"
                + model,
                data=json.dumps(payload).encode(),
                headers={
                    "Authorization": "Bearer " + s.cloudflare_api_token.get_secret_value(),
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Accept-Encoding": "identity",
                },
                method="POST",
            )
            start = monotonic()
            http_status = None
            try:
                with urlopen(request, timeout=35) as response:
                    http_status = getattr(response, "status", 200)
                    data, _diagnostic = read_json_response(response)
                if isinstance(data, dict) and (data.get("success") is False or data.get("errors")):
                    self.fail(
                        "AI_PROVIDER_ERROR",
                        "أبلغت Cloudflare عن فشل الطلب. أُوقف الاستدلال؛ راجع رمز الخطأ في سجل الخادم.",
                        reason="api_error_envelope",
                        halt=True,
                        status=502,
                        http_status=http_status,
                        codes=api_error_codes(data),
                    )
                if embedding:
                    result = data.get("result", data) if isinstance(data, dict) else None
                    vectors = result.get("data") if isinstance(result, dict) else None
                    if (
                        not isinstance(vectors, list)
                        or len(vectors) != len(payload["text"])
                        or any(
                            not isinstance(v, list)
                            or len(v) != 1024
                            or any(
                                isinstance(n, bool)
                                or not isinstance(n, (float, int))
                                or not math.isfinite(n)
                                for n in v
                            )
                            or not any(v)
                            for v in vectors
                        )
                    ):
                        raise ResponseFormatError("embedding_shape_invalid")
                    return vectors
                text, shape = extract_model_response(data)
                finish_reason, truncation = finish_diagnostic(data)
                logger.info(
                    "workers_ai_success http_status=%s shape=%s chars=%s elapsed_ms=%s "
                    "finish_reason=%s truncation=%s",
                    http_status,
                    shape,
                    len(text),
                    round((monotonic() - start) * 1000),
                    finish_reason,
                    truncation,
                )
                return text
            except HTTPError as error:
                codes = "none"
                try:
                    error_data, _ = read_json_response(error)
                    codes = api_error_codes(error_data)
                except (
                    ResponseFormatError,
                    OSError,
                    ValueError,
                    TypeError,
                    AttributeError,
                    IncompleteRead,
                ):
                    pass
                finally:
                    error.close()
                retry_header = str((error.headers or {}).get("Retry-After", ""))
                retry_seconds = (
                    int(retry_header) if re.fullmatch(r"[0-9]{1,5}", retry_header) else None
                )
                logger.warning(
                    "workers_ai_http_error http_status=%s api_codes=%s retry_after_seconds=%s",
                    error.code,
                    codes,
                    retry_seconds,
                )
                if error.code in (402, 429):
                    self.fail(
                        "AI_QUOTA_OR_RATE_LIMIT",
                        "أُوقف الاستدلال: يتطلب الطلب دفعًا أو ترقية أو فُرض حد استخدام من Cloudflare. لن نستخدم خدمة مدفوعة.",
                        reason="http_quota_or_rate_limit",
                        halt=True,
                        http_status=error.code,
                        codes=codes,
                    )
                if error.code in (401, 403):
                    self.fail(
                        "AI_ACCESS_DENIED",
                        "أُوقف الاستدلال: رُفض الوصول إلى Cloudflare أو النموذج. راجع الصلاحيات وسياسة الشبكة.",
                        reason="http_access_denied",
                        halt=True,
                        http_status=error.code,
                        codes=codes,
                    )
                self.fail(
                    "AI_PROVIDER_ERROR",
                    "أُوقف الاستدلال بعد خطأ HTTP من Cloudflare. لم تُفعّل أي خدمة بديلة.",
                    reason="http_provider_error",
                    halt=True,
                    status=502,
                    http_status=error.code,
                    codes=codes,
                )
            except ResponseFormatError as error:
                self.fail(
                    "AI_PROVIDER_RESPONSE_INVALID",
                    "تعذّر قراءة تنسيق استجابة Cloudflare. راجع سبب workers_ai_failure في سجل الخادم؛ لم تُولّد إجابة بديلة.",
                    reason=str(error),
                    halt=False,
                    status=502,
                    http_status=http_status,
                )
            except (URLError, TimeoutError, OSError, IncompleteRead) as error:
                self.fail(
                    "AI_CONNECTION_FAILED",
                    "أُوقف الاستدلال لتعذّر الاتصال بـ Cloudflare. تحقق من الشبكة قبل إعادة تشغيل الخدمة.",
                    reason=network_kind(error),
                    halt=True,
                    http_status=http_status,
                )
            except (ValueError, TypeError):
                self.fail(
                    "AI_CONFIGURATION_INVALID",
                    "تعذّر تكوين طلب Cloudflare. راجع إعدادات الخدمة الخلفية دون مشاركة التوكن.",
                    reason="request_configuration_invalid",
                    halt=True,
                )
        finally:
            self._lock.release()
