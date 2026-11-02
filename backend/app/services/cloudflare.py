"""Cloudflare-only adapter: no billing changes, gateway, retries or fallback."""

import json
import re
from threading import Lock
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import Settings

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


class CloudflareProvider:
    """A single demo process may make at most 20 bounded inference attempts.

    The user must confirm an ACTUAL Workers Free account; this flag cannot audit
    billing. The provider's free-plan cap is authoritative across all clients.
    Any network/provider error latches this process off until explicit restart.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self._lock = Lock()
        self._calls = 0
        self._halted = False

    def generate(self, system: str, question: str) -> str:
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
        if (
            not re.fullmatch(r"[0-9a-fA-F]{32}", s.cloudflare_account_id)
            or s.cloudflare_model not in SUPPORTED_MODELS
        ):
            raise AIUnavailable(
                "AI_CONFIGURATION_INVALID",
                "إعدادات الحساب أو نموذج Llama غير صالحة. راجع إعدادات الخدمة الخلفية.",
            )
        if not self._lock.acquire(blocking=False):
            raise AIUnavailable("AI_BUSY", "يوجد سؤال قيد المعالجة. انتظر ثم أعد المحاولة.", 429)
        try:
            if self._halted:
                raise AIUnavailable(
                    "AI_HALTED",
                    "أُوقفت طلبات Llama بعد فشل الاتصال أو حد الاستخدام. يلزم فحص الإعدادات قبل إعادة تشغيل الخدمة.",
                )
            if self._calls >= 20:
                self._halted = True
                raise AIUnavailable(
                    "DEMO_LIMIT_REACHED",
                    "وصلت التجربة إلى حد الطلبات المحلي. أُوقف الاستدلال لحماية الحصة المجانية.",
                )
            self._calls += 1
            request = Request(
                "https://api.cloudflare.com/client/v4/accounts/"
                + s.cloudflare_account_id
                + "/ai/run/"
                + s.cloudflare_model,
                data=json.dumps(
                    {
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": question},
                        ],
                        "max_tokens": 600,
                        "temperature": 0.1,
                        "stream": False,
                    }
                ).encode(),
                headers={
                    "Authorization": "Bearer " + s.cloudflare_api_token.get_secret_value(),
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            try:
                with urlopen(request, timeout=35) as response:
                    data = json.loads(response.read(100_000))
                result = data.get("result", {})
                text = result.get("response") if isinstance(result, dict) else None
                if data.get("success") is not True or not isinstance(text, str) or not text.strip():
                    raise ValueError("Unexpected provider response")
                return text
            except HTTPError as error:
                self._halted = True
                if error.code in (402, 429):
                    raise AIUnavailable(
                        "AI_QUOTA_OR_RATE_LIMIT",
                        "أُوقف الاستدلال: انتهت الحصة المجانية أو فُرض حد استخدام من Cloudflare. لن نستخدم خدمة مدفوعة.",
                    ) from None
                if error.code in (401, 403):
                    raise AIUnavailable(
                        "AI_ACCESS_DENIED",
                        "أُوقف الاستدلال: رُفض الوصول إلى Cloudflare أو إلى النموذج. راجع الصلاحيات وسياسة الشبكة.",
                    ) from None
                raise AIUnavailable(
                    "AI_PROVIDER_ERROR",
                    "أُوقف الاستدلال بعد خطأ من Cloudflare. لم تُفعّل أي خدمة بديلة.",
                    502,
                ) from None
            except (URLError, TimeoutError, OSError):
                self._halted = True
                raise AIUnavailable(
                    "AI_CONNECTION_FAILED",
                    "أُوقف الاستدلال لتعذّر الاتصال بـ Cloudflare. تحقق من الشبكة قبل إعادة تشغيل الخدمة.",
                ) from None
            except (ValueError, TypeError, AttributeError):
                self._halted = True
                raise AIUnavailable(
                    "AI_PROVIDER_RESPONSE_INVALID",
                    "أُوقف الاستدلال بسبب استجابة غير صالحة من Cloudflare.",
                    502,
                ) from None
        finally:
            self._lock.release()
