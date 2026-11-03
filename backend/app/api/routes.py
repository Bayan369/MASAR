from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1")


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "masar-api"
    version: str = "0.1.0"


@router.get("/health", response_model=HealthResponse, tags=["النظام"])
def health() -> HealthResponse:
    """Process liveness only; this check does not contact external dependencies."""
    return HealthResponse()


@router.get("/ready")
def ready(request: Request) -> dict:
    """Local prerequisites only: never performs an inference or external request."""
    if request.app.state.settings.environment == "demo":
        from app.services.retrieval import passages

        if not passages() or request.app.state.ai_provider._halted:
            raise HTTPException(
                status_code=503, detail={"code": "NOT_READY", "message": "الخدمة غير جاهزة."}
            )
    return {"status": "ready"}
