from fastapi import APIRouter
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
