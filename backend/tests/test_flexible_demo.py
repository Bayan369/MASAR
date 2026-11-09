"""Offline contracts only: scripted transport does not prove live Llama availability."""

import json

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.assistant import answer_question
from app.services.cloudflare import AIUnavailable
from app.services.demo_conversation import answer_demo_question
from app.services.general_answer import GENERAL_NOTICE, answer_general
from test_assistant import StubLlama


class EmptySearch:
    def search(self, *_, **__):
        return []


class FailedSearch:
    def __init__(self, code):
        self.code = code

    def search(self, *_, **__):
        raise AIUnavailable(self.code, "PRIVATE_INTERNAL", 502)


class FlexibleTransport(StubLlama):
    def __init__(self, mode="valid", general=None):
        super().__init__(mode)
        self.general = general or '{"answer":"يمكن تنظيم العمل بتحديد الأولويات ومراجعتها دوريًا."}'
        self.general_calls = 0
        self.last_general_prompt = ""

    def generate(self, prompt, question):
        if "This is GENERAL knowledge" in prompt:
            self.calls += 1
            self.general_calls += 1
            self.last_general_prompt = prompt
            return self.general
        return super().generate(prompt, question)


def assert_general(result):
    assert result.status == "general" and result.sources == []
    assert result.answer.startswith(GENERAL_NOTICE)
    assert result.generated_by == "Cloudflare Workers AI / Llama"
    assert result.model == "@cf/meta/llama-3.1-8b-instruct-fp8-fast"


def test_documented_answer_keeps_real_evidence_without_general_call():
    provider = FlexibleTransport()
    result = answer_demo_question("كم الإجازة السنوية؟", provider, [])
    assert result.status == "answered" and result.sources[0].document_id == "leave-policy"
    assert result.sources[0].quote in result.sources[0].excerpt
    assert provider.calls == 1 and provider.general_calls == 0


def test_no_documents_generates_general_from_model_with_context():
    provider = FlexibleTransport()
    history = [
        {"role": "user", "content": "كيف أنظم وقتي؟"},
        {"role": "assistant", "content": "هل تريد خطوات؟"},
    ]
    result = answer_demo_question("إيه", provider, history, EmptySearch(), Settings(_env_file=None))
    assert_general(result)
    assert provider.calls == provider.general_calls == 1
    assert "كيف أنظم وقتي؟" in provider.last_general_prompt
    assert "DOCUMENT CONTEXT" not in provider.last_general_prompt
    assert "Never claim to know this company's policies" in provider.last_general_prompt


@pytest.mark.parametrize(
    "code", ["AI_SEARCH_INVALID", "AI_SEARCH_INCOMPLETE", "AI_EMBEDDING_INVALID"]
)
def test_unusable_retrieval_can_only_produce_labeled_general_not_unchecked_company(code):
    provider = FlexibleTransport()
    assert_general(
        answer_demo_question("سؤال", provider, [], FailedSearch(code), Settings(_env_file=None))
    )
    assert provider.general_calls == provider.calls == 1


@pytest.mark.parametrize("mode", ["invalid", "source", "quote", "number", "unsupported"])
def test_failed_company_grounding_requires_fresh_general_generation(mode):
    provider = FlexibleTransport(mode)
    result = answer_demo_question("كم الإجازة السنوية؟", provider, [])
    assert_general(result)
    assert provider.calls == 2 and provider.general_calls == 1
    assert "21" not in result.answer and "99" not in result.answer
    assert "DOCUMENT CONTEXT" not in provider.last_general_prompt


@pytest.mark.parametrize(
    "code",
    [
        "AI_CONNECTION_FAILED",
        "AI_BUDGET_REACHED",
        "AI_QUOTA_OR_RATE_LIMIT",
        "AI_HALTED",
        "AI_ACCESS_DENIED",
    ],
)
def test_service_and_budget_failures_do_not_trigger_another_generation(code):
    provider = FlexibleTransport()
    with pytest.raises(AIUnavailable) as error:
        answer_demo_question("سؤال", provider, [], FailedSearch(code), Settings(_env_file=None))
    assert error.value.code == code and provider.calls == 0


@pytest.mark.parametrize(
    "raw",
    [
        '{"answer":"PRIVATE_TRUNCATED',
        '{"answer":""}',
        '{"answer":"   "}',
        '{"answer":123}',
        json.dumps({"answer": "x" * 4001}),
        '{"answer":"PRIVATE_TEXT","sources":["fake"]}',
    ],
)
def test_bad_or_long_general_output_is_not_repaired_or_shown(raw, caplog):
    provider = FlexibleTransport(general=raw)
    with pytest.raises(AIUnavailable) as error:
        answer_general("سؤال", provider, [])
    assert error.value.code == "AI_GENERAL_INVALID"
    assert provider.calls == 1 and "PRIVATE_" not in caplog.text


def test_general_provider_failure_propagates_without_synthetic_answer():
    class Unavailable(FlexibleTransport):
        def generate(self, *_):
            self.calls += 1
            raise AIUnavailable("AI_CONNECTION_FAILED", "تعذّر الاتصال بخدمة المساعد.")

    provider = Unavailable()
    with pytest.raises(AIUnavailable) as error:
        answer_demo_question("سؤال", provider, [], EmptySearch(), Settings(_env_file=None))
    assert error.value.code == "AI_CONNECTION_FAILED" and provider.calls == 1


def test_demo_api_serializes_general_status_with_no_company_sources():
    app = create_app(Settings(_env_file=None, demo_enabled=True, retrieval_mode="hybrid"))
    app.state.ai_provider = FlexibleTransport()
    app.state.demo_search = EmptySearch()
    with TestClient(app) as client:
        response = client.post("/api/v1/demo/ask", json={"question": "كيف أنظم وقتي؟"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "general" and data["sources"] == []
    assert data["answer"].startswith(GENERAL_NOTICE)


def test_protected_strict_answer_path_still_does_not_use_general_knowledge():
    provider = FlexibleTransport()
    result = answer_question("سؤال", provider, retrieved_hits=[], demo=False)
    assert result.status == "not_found" and not result.sources and provider.calls == 0
