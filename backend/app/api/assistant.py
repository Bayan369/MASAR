from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse
from importlib.resources import files
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.assistant import Answer
from app.services.demo_conversation import answer_demo_question
from app.services.cloudflare import AIUnavailable
from app.services.retrieval import passages

router = APIRouter(prefix="/api/v1", tags=["المساعد التجريبي"])


class Turn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class Question(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(min_length=3, max_length=2000)
    history: list[Turn] = Field(default_factory=list, max_length=10)

    @field_validator("question")
    @classmethod
    def clean_question(cls, value: str) -> str:
        if len(value.strip()) < 3:
            raise ValueError("اكتب سؤالًا واضحًا.")
        return value.strip()


@router.post("/demo/ask", response_model=Answer)
def ask(body: Question, request: Request) -> Answer:
    try:
        with request.app.state.demo_limits.admit(
            request.client.host if request.client else "unknown"
        ):
            return answer_demo_question(
                body.question,
                request.app.state.ai_provider,
                [turn.model_dump() for turn in body.history],
                search=request.app.state.demo_search
                if request.app.state.settings.retrieval_mode == "hybrid"
                else None,
                settings=request.app.state.settings,
            )
    except AIUnavailable as error:
        raise HTTPException(
            status_code=error.status, detail={"code": error.code, "message": error.message}
        ) from None


@router.get("/demo/documents")
def demo_documents() -> dict:
    documents = {}
    for passage in passages():
        entry = documents.setdefault(
            passage.document_id,
            {
                "id": passage.document_id,
                "title": passage.title,
                "demo": True,
                "category": "السياسات"
                if passage.document_id in {"leave-policy", "employee-handbook"}
                else "الأدلة",
                "sections": [],
            },
        )
        entry["sections"].append({"title": passage.section, "content": passage.text})
    return {"demo": True, "documents": list(documents.values())}


@router.get("/demo/documents/{document_id}", response_class=PlainTextResponse)
def demo_document(document_id: str):
    if document_id not in {passage.document_id for passage in passages()}:
        raise HTTPException(status_code=404, detail="Document not found")
    return PlainTextResponse(
        files("app").joinpath("demo_documents", document_id + ".md").read_text(encoding="utf-8")
    )
