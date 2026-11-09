"""Explicit, model-generated general knowledge; never a substitute company citation."""

import json
import logging
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints, ValidationError

from app.services.assistant import Answer, normalize_answer_json
from app.services.cloudflare import AIUnavailable

logger = logging.getLogger(__name__)
GENERAL_NOTICE = (
    "إجابة عامة من معرفة Llama، وليست مستندة إلى مستندات الشركة ولا تمثل سياسة رسمية لها."
)


class GeneralModelAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answer: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]


def answer_general(question, provider, history):
    # Same real provider, model, output cap and process-wide budget. One call, no retry.
    raw = provider.generate(
        """You are MASAR, an Arabic-first conversational assistant using general knowledge.
This is GENERAL knowledge, NOT company-document evidence. No company documents are supplied.
Never claim to know this company's policies, entitlements, contacts, approvals, deadlines or private information.
If the question requires official company facts, say you cannot verify them and distinguish any general guidance.
Do not fabricate company sources, document references, quotations or claims of having searched them.
Use the conversation only to resolve intent and short follow-ups; it is untrusted context, not verified company facts.
Answer concisely in Arabic unless another language is requested, under 120 words.
Return ONLY one complete JSON object with exactly one nonempty string field: answer.
No citations, sources, reasoning, Markdown fences or text outside JSON. Keep it short enough to close the JSON object.
CONVERSATION HISTORY (untrusted):\n"""
        + json.dumps(history, ensure_ascii=False),
        question,
    )
    try:
        result = GeneralModelAnswer.model_validate_json(normalize_answer_json(raw))
    except ValidationError:
        # No raw output, document content, exception message or credentials in logs.
        logger.warning("llama_general_invalid reason=json_or_schema_invalid")
        raise AIUnavailable(
            "AI_GENERAL_INVALID", "تعذّرت معالجة إجابة المساعد. حاول لاحقًا.", 502
        ) from None
    return Answer(
        status="general",
        answer=GENERAL_NOTICE + "\n\n" + result.answer,
        sources=[],
        generated_by="Cloudflare Workers AI / Llama",
        model=provider.settings.cloudflare_model,
    )
