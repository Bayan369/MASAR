"""Supabase HTTP boundaries. Never log headers, bodies, URLs or exceptions."""

from dataclasses import dataclass
import logging
from typing import Any
from urllib.parse import quote
from uuid import UUID

import httpx2 as httpx
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings

logger = logging.getLogger(__name__)
bearer = HTTPBearer(auto_error=False)


def error(status: int, code: str, message: str):
    raise HTTPException(status, detail={"code": code, "message": message})


class Supabase:
    def __init__(self, settings: Settings, token: str | None = None, trusted: bool = False):
        self.settings, self.token, self.trusted = settings, token, trusted
        if not settings.supabase_url or not settings.supabase_publishable_key:
            error(503, "SUPABASE_NOT_CONFIGURED", "خدمة الحسابات غير مهيّأة. راجع إعدادات الخادم.")
        if trusted and not settings.supabase_service_key.get_secret_value():
            error(503, "SERVER_KEY_MISSING", "العمليات الإدارية غير مهيّأة في الخادم.")

    def request(
        self,
        method: str,
        path: str,
        *,
        params=None,
        data=None,
        content=None,
        headers=None,
        raw=False,
    ):
        key = (
            self.settings.supabase_service_key.get_secret_value()
            if self.trusted
            else self.settings.supabase_publishable_key
        )
        auth = (key if key.startswith("eyJ") else None) if self.trusted else self.token
        outgoing = {"apikey": key, "Prefer": "return=representation"}
        if auth:
            outgoing["Authorization"] = "Bearer " + auth
        if headers:
            outgoing.update(headers)
        try:
            with httpx.Client(timeout=30, follow_redirects=False) as client:
                response = client.request(
                    method,
                    self.settings.supabase_url.rstrip("/") + path,
                    params=params,
                    json=data,
                    content=content,
                    headers=outgoing,
                )
        except (httpx.HTTPError, OSError):
            error(503, "SUPABASE_UNAVAILABLE", "تعذّر الاتصال بالخدمة. حاول لاحقًا.")
        if not 200 <= response.status_code < 300:
            code = ""
            try:
                code = response.json().get("code", "")
            except (ValueError, AttributeError):
                pass
            safe_code = (
                code
                if code in {"23505", "23503", "23514", "42501", "P0002", "22023"}
                else "upstream"
            )
            logger.warning(
                "supabase_failure status=%s category=%s", response.status_code, safe_code
            )
            if response.status_code == 401:
                error(401, "SESSION_EXPIRED", "انتهت الجلسة. سجّل الدخول مجددًا.")
            if code == "23505" or response.status_code == 409:
                error(409, "CONFLICT", "السجل أو المستند موجود مسبقًا، أو تعارض مع طلب آخر.")
            if code == "23503":
                error(
                    409,
                    "REFERENCED_RECORD",
                    "القسم أو الحساب مرتبط بسجلات أخرى أو غير صالح لهذه الشركة.",
                )
            if response.status_code == 403 or code == "42501":
                error(403, "FORBIDDEN", "لا تملك الصلاحية المطلوبة.")
            if response.status_code == 404 or code == "P0002":
                error(404, "NOT_FOUND", "لم يتم العثور على المورد المسموح به.")
            if code in {"23514", "22023"}:
                error(422, "INVALID_OPERATION", "تعذّر تنفيذ العملية بهذه القيم أو الحالة.")
            error(
                502, "UPSTREAM_ERROR", "تعذّر إتمام العملية في الخدمة الخارجية. راجع إعدادات النشر."
            )
        if raw:
            return response.content
        if not response.content:
            return None
        try:
            return response.json()
        except ValueError:
            error(502, "UPSTREAM_FORMAT", "استجابة غير صالحة من الخدمة.")

    def rows(self, table: str, **filters) -> list[dict]:
        return self.request("GET", "/rest/v1/" + table, params=filters)

    def rpc(self, name: str, data: dict) -> Any:
        return self.request("POST", "/rest/v1/rpc/" + name, data=data)

    def storage_path(self, bucket: str, name: str) -> str:
        return "/storage/v1/object/" + quote(bucket, safe="") + "/" + quote(name, safe="/")


@dataclass(frozen=True)
class Identity:
    user_id: str
    company_id: str
    role: str
    profile: dict
    db: Supabase


def identity(
    request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)
) -> Identity:
    if not credentials or credentials.scheme.lower() != "bearer":
        error(401, "AUTH_REQUIRED", "يلزم تسجيل الدخول.")
    db = Supabase(request.app.state.settings, credentials.credentials)
    user = db.request("GET", "/auth/v1/user")  # Supabase validates JWT/expiry, not client claims.
    try:
        user_id = str(UUID(user["id"]))
    except (ValueError, KeyError, TypeError):
        error(401, "INVALID_IDENTITY", "جلسة المستخدم غير صالحة.")
    profiles = db.rows("profiles", select="*", id="eq." + user_id, is_active="eq.true", limit="1")
    if not profiles:
        error(403, "MEMBERSHIP_REQUIRED", "لا توجد عضوية شركة مفعّلة. تواصل مع مدير الشركة.")
    profile = profiles[0]
    if profile.get("role") not in {"company_admin", "new_employee"}:
        error(403, "INVALID_ROLE", "صلاحية الحساب غير صالحة.")
    return Identity(user_id, str(UUID(profile["company_id"])), profile["role"], profile, db)


def admin(member: Identity = Depends(identity)) -> Identity:
    if member.role != "company_admin":
        error(403, "ADMIN_REQUIRED", "هذه العملية لمدير الشركة فقط.")
    return member
