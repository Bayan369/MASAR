"""Offline schema/prompt contracts only; not evidence of live Llama understanding."""

import json

import pytest
from pydantic import ValidationError

from app.services.cloudflare import AIUnavailable
from app.services.semantic_search import Intent, IntentRewrite, resolve_intent


def payload(request, scope="broad", query="إجراءات العمل المطلوبة"):
    return {"query": query, "intent": {"request": request, "scope": scope, "conditions": []}}


class RewriteOutput:
    def __init__(self, result):
        self.result = result
        self.calls = 0
        self.prompt = None
        self.question = None

    def generate(self, prompt, question):
        self.calls += 1
        self.prompt = prompt
        self.question = question
        return json.dumps(self.result, ensure_ascii=False)


@pytest.mark.parametrize("value", ["", " ", "\t\n", " \r\n\t ", "\u00a0"])
def test_empty_or_whitespace_summary_remains_invalid_without_compensation(value, caplog):
    result = payload(value, query="استعلام بحث صالح لا يعوض الملخص")
    with pytest.raises(ValidationError) as error:
        IntentRewrite.model_validate(result)
    assert any(
        e["type"] == "string_too_short" and e["loc"] == ("intent", "request")
        for e in error.value.errors()
    )
    provider = RewriteOutput(result)
    with pytest.raises(AIUnavailable) as rejected:
        resolve_intent("سؤال أصلي صالح لا يعوض الملخص", [], provider)
    assert rejected.value.code == "AI_SEARCH_INVALID" and rejected.value.status == 502
    assert provider.calls == 1  # No retry, query substitution or original-question fallback.
    assert "type=string_too_short field=request path=intent.request" in caplog.text
    assert "سؤال أصلي" not in caplog.text and "استعلام بحث" not in caplog.text


@pytest.mark.parametrize("summary", ["معرفة إجراءات بدء العمل", "  طلب إجراء العمل  ", "x"])
def test_concise_summary_is_accepted_without_requiring_full_question(summary):
    provider = RewriteOutput(payload(summary))
    result = resolve_intent(
        "ما الإجراءات التي ينبغي اتباعها عند بدء العمل في الشركة؟", [], provider
    )
    assert result.intent.request == summary.strip()
    assert result.intent.request != provider.question
    assert provider.calls == 1


def test_request_schema_changes_description_only_not_validation_limits():
    schema = IntentRewrite.model_json_schema()["$defs"]["Intent"]
    field = schema["properties"]["request"]
    assert field["minLength"] == 1 and field["maxLength"] == 300
    assert "request" in schema["required"]
    assert "nonempty" in field["description"] and "unresolved ambiguity" in field["description"]
    assert "default" not in field
    for invalid in [None, "x" * 301]:
        with pytest.raises(ValidationError):
            Intent.model_validate(payload(invalid)["intent"])


@pytest.mark.parametrize(
    "question,summary,scope,history",
    [
        ("ما المطلوب عند بدء العمل؟", "معرفة متطلبات بدء العمل", "broad", []),
        (
            "وش الخطوات المطلوبة؟",
            "معرفة الخطوات المطلوبة مع بقاء الموضوع غير محدد",
            "ambiguous",
            [],
        ),
        (
            "What should I do next?",
            "Understand the next action; topic is unresolved",
            "ambiguous",
            [],
        ),
        (
            "إيه",
            "معرفة الخطوة التالية لطلب الجهاز",
            "specific",
            [
                {"role": "user", "content": "كيف أطلب جهاز العمل؟"},
                {"role": "assistant", "content": "هل تريد معرفة الخطوة التالية؟"},
            ],
        ),
    ],
)
def test_prompt_contract_preserves_general_scope_uncertainty_and_existing_context(
    question, summary, scope, history
):
    # Explicit scripted outputs verify transport/contracts, not semantic inference.
    provider = RewriteOutput(payload(summary, scope))
    result = resolve_intent(question, history, provider)
    assert result.intent.request == summary and result.intent.scope == scope
    assert result.intent.conditions == []
    assert provider.question == question and provider.calls == 1
    prompt = provider.prompt
    for instruction in [
        "concise, standalone, nonempty summary",
        "a full restatement is not required",
        "preserve their breadth",
        "retain its uncertainty with scope=ambiguous",
        "do not leave intent.request blank or invent a topic",
        "ONLY when established by the original question or history",
    ]:
        assert instruction in prompt
    context = json.loads(prompt.split("CONTEXT JSON:\n", 1)[1])
    assert context["history"] == history
    description = context["response_schema"]["$defs"]["Intent"]["properties"]["request"][
        "description"
    ]
    assert "concise standalone summary" in description
