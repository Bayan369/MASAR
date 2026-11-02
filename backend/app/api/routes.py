from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1")


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "masar-api"
    version: str = "0.1.0"


@router.get("/health", response_model=HealthResponse, tags=["النظام"])
def health() -> HealthResponse:
    """Process health only; no AI, authentication, or database is connected."""
    return HealthResponse()


@router.post("/auth/login", tags=["المصادقة"], status_code=501)
def login_unavailable() -> None:
    """Capability boundary; deliberately accepts no credentials and creates no session."""
    raise HTTPException(
        status_code=501,
        detail={"code": "AUTH_NOT_CONFIGURED", "message": "تسجيل الدخول غير مفعّل بعد."},
    )
