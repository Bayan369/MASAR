from threading import Lock
from time import monotonic
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import Field

from app.api.assistant import Question
from app.services.assistant import Answer, answer_question
from app.services.cloudflare import AIUnavailable
from app.services.retrieval import Hit, Passage
from app.services.semantic_search import rewrite_query
from app.services.demo_conversation import AFFIRMATIVE, clean_social_prefix
from app.services.supabase import Identity, Supabase, identity, error

router = APIRouter(prefix="/api/v1", tags=["المساعد"])
_lock = Lock()
_limits = {}


class Ask(Question):
    conversation_id: UUID | None = None
    request_id: UUID = Field(default_factory=uuid4)


@router.post("/assistant/ask", response_model=Answer)
def ask(body: Ask, request: Request, member: Identity = Depends(identity)):
    with _lock:
        now = monotonic()
        expired = [key for key, (since, count) in _limits.items() if since < now - 60]
        for key in expired:
            del _limits[key]
        since, count = _limits.get(member.user_id, (now, 0))
        if count >= 30 or (member.user_id not in _limits and len(_limits) >= 10000):
            error(429, "RATE_LIMIT", "طلبات كثيرة. انتظر دقيقة ثم حاول مجددًا.")
        _limits[member.user_id] = (since, count + 1)
    cached = member.db.rows(
        "messages",
        select="content,citations,response_status,model,conversation_id",
        company_id="eq." + member.company_id,
        turn_id="eq." + str(body.request_id),
        role="eq.assistant",
        limit="1",
    )
    if cached:
        row = cached[0]
        original = member.db.rows(
            "messages",
            select="content",
            conversation_id="eq." + row["conversation_id"],
            turn_id="eq." + str(body.request_id),
            role="eq.user",
            limit="1",
        )
        if not original or original[0]["content"] != body.question:
            error(409, "REQUEST_CONFLICT", "معرّف الطلب مرتبط بسؤال آخر.")
        if body.conversation_id and str(body.conversation_id) != row["conversation_id"]:
            error(409, "REQUEST_CONFLICT", "معرّف الطلب مرتبط بمحادثة أخرى.")
        return Answer(
            status=row["response_status"],
            answer=row["content"],
            sources=row["citations"],
            demo=False,
            generated_by="Cloudflare Workers AI / Llama" if row["model"] else None,
            model=row["model"],
            conversation_id=row["conversation_id"],
            request_id=str(body.request_id),
        )
    if body.conversation_id:
        conv_id = str(body.conversation_id)
        if not member.db.rows(
            "conversations",
            select="id",
            id="eq." + conv_id,
            company_id="eq." + member.company_id,
            owner_id="eq." + member.user_id,
        ):
            error(404, "NOT_FOUND", "المحادثة غير متاحة.")
    else:
        try:
            rows = member.db.request(
                "POST",
                "/rest/v1/conversations",
                data={
                    "company_id": member.company_id,
                    "owner_id": member.user_id,
                    "title": body.question[:80],
                    "initial_request_id": str(body.request_id),
                },
            )
        except HTTPException as exc:
            if exc.status_code != 409:
                raise
            rows = member.db.rows(
                "conversations",
                select="id",
                owner_id="eq." + member.user_id,
                company_id="eq." + member.company_id,
                initial_request_id="eq." + str(body.request_id),
                limit="1",
            )
            if not rows:
                raise
        conv_id = rows[0]["id"]
    try:
        # Read only after verifying conversation ownership; never trust client history here.
        history = []
        if body.conversation_id:
            previous = member.db.rows(
                "messages",
                select="role,content",
                company_id="eq." + member.company_id,
                conversation_id="eq." + conv_id,
                order="created_at.desc,id.desc",
                limit="10",
            )
            history = [
                {"role": row["role"], "content": row["content"][:2000]}
                for row in reversed(previous)
                if row.get("role") in {"user", "assistant"}
                and isinstance(row.get("content"), str)
                and row["content"].strip()
            ]
        query = body.question
        embedding = None
        if request.app.state.settings.retrieval_mode == "hybrid":
            if history:
                query = rewrite_query(body.question, history, request.app.state.ai_provider)
            embedding = request.app.state.ai_provider.embed([query])[0]
        elif history and AFFIRMATIVE.fullmatch(clean_social_prefix(query)):
            query = next(
                (
                    row["content"]
                    for row in reversed(history)
                    if row["role"] == "user"
                    and not AFFIRMATIVE.fullmatch(clean_social_prefix(row["content"]))
                ),
                query,
            )
        rows = member.db.rpc(
            "search_chunks",
            {"query_text": query, "query_embedding": embedding, "result_limit": 6},
        )
        hits = [
            Hit(
                Passage(
                    row["id"],
                    row["document_id"],
                    row["title"],
                    row.get("section_title")
                    or (
                        "صفحة " + str(row["page_number"])
                        if row.get("page_number")
                        else "مقطع من المستند"
                    ),
                    row["content"],
                    row.get("page_number"),
                ),
                float(row["score"]),
            )
            for row in rows
        ]
        result = answer_question(
            body.question,
            request.app.state.ai_provider,
            retrieved_hits=hits,
            demo=False,
            conversation=history,
        )
        Supabase(request.app.state.settings, trusted=True).rpc(
            "save_turn",
            {
                "actor": member.user_id,
                "conversation": conv_id,
                "request_id": str(body.request_id),
                "question": body.question,
                "answer": result.answer,
                "source_refs": [s.model_dump() for s in result.sources],
                "answer_status": result.status,
                "model_id": result.model,
            },
        )
        return result.model_copy(
            update={"conversation_id": conv_id, "request_id": str(body.request_id)}
        )
    except AIUnavailable as exc:
        raise HTTPException(exc.status, detail={"code": exc.code, "message": exc.message}) from None
