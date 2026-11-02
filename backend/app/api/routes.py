from fastapi import APIRouter
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
