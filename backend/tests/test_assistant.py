"""Offline contract tests only. Synthetic model outputs are never a live-inference claim."""

import json
from urllib.error import HTTPError, URLError

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.assistant import answer_question
from app.services.cloudflare import AIUnavailable, CloudflareProvider


def settings(**kwargs):
    return Settings(
        _env_file=None,
        cloudflare_account_id="a" * 32,
        cloudflare_api_token="test-only-token",
        **kwargs,
    )


class StubLlama:
    settings = settings()

    def __init__(self, mode="valid"):
        self.mode = mode
        self.calls = 0

    def generate(self, system, question):
        self.calls += 1
        context = json.loads(system.split("DOCUMENT CONTEXT:\n")[1])
        if self.mode == "invalid":
            return "not json"
        if self.mode == "unsupported":
            return json.dumps({"supported": False, "answer": "", "citations": []})
        source = next(c for c in context if any("21" in e["text"] for e in c["evidence"]))
        evidence = next(e for e in source["evidence"] if "21" in e["text"])
        return json.dumps(
            {
                "supported": True,
                "answer": "الإجازة السنوية في الشركة التجريبية 21 يوم عمل."
                if self.mode != "number"
                else "الإجازة السنوية 99 يوم عمل.",
                "citations": [
                    {
                        "source_id": "S99" if self.mode == "source" else source["source_id"],
                        "evidence_ids": ["S1:E9999"]
                        if self.mode == "quote"
                        else [evidence["evidence_id"]],
                    }
                ],
            }
        )


def test_grounded_answer_contains_real_source_evidence():
    provider = StubLlama()
    result = answer_question("How many annual leave days?", provider)
    assert result.status == "answered"
    assert result.demo is True
    assert result.sources[0].document_id == "leave-policy"
    assert result.sources[0].quote in result.sources[0].excerpt
    assert result.generated_by == "Cloudflare Workers AI / Llama"


@pytest.mark.parametrize("mode", ["invalid", "source", "quote", "number"])
def test_invalid_evidence_is_an_explicit_error_not_a_hidden_fallback(mode):
    with pytest.raises(AIUnavailable) as error:
        answer_question("How many annual leave days?", StubLlama(mode))
    assert error.value.code == "AI_ANSWER_INVALID"
    assert error.value.status == 502


def test_explicit_unsupported_answer_remains_a_real_not_found():
    result = answer_question("How many annual leave days?", StubLlama("unsupported"))
    assert result.status == "not_found"
    assert result.sources == []
    assert result.generated_by is None


def test_no_retrieval_means_no_inference():
    provider = StubLlama()
    assert answer_question("quantum banana spaceship", provider).status == "not_found"
    assert provider.calls == 0


def test_fastapi_question_and_original_documents():
    app = create_app(Settings(_env_file=None, demo_enabled=True, retrieval_mode="lexical"))
    app.state.ai_provider = StubLlama()
    with TestClient(app) as client:
        response = client.post("/api/v1/demo/ask", json={"question": "How many annual leave days?"})
        assert response.status_code == 200
        assert response.json()["sources"][0]["document_id"] == "leave-policy"
        docs = client.get("/api/v1/demo/documents").json()
        assert docs["demo"] is True and len(docs["documents"]) == 4
        assert all(d["demo"] for d in docs["documents"])
        assert client.post("/api/v1/demo/ask", json={"question": "   "}).status_code == 422
        bad = client.post("/api/v1/demo/ask", json={"question": "private-input" * 200})
        assert bad.status_code == 422
        assert "private-input" not in bad.text


def test_free_confirmation_prevents_any_request(monkeypatch):
    monkeypatch.setattr(
        "app.services.cloudflare.urlopen", lambda *a, **k: pytest.fail("Network forbidden")
    )
    with pytest.raises(AIUnavailable) as error:
        CloudflareProvider(settings()).generate("context", "question")
    assert error.value.code == "FREE_PLAN_NOT_CONFIRMED"


@pytest.mark.parametrize(
    "failure,code",
    [
        (URLError("private-internal-detail"), "AI_CONNECTION_FAILED"),
        (HTTPError("https://example.invalid", 429, "quota", None, None), "AI_QUOTA_OR_RATE_LIMIT"),
        (
            HTTPError("https://example.invalid", 403, "private-internal-detail", None, None),
            "AI_ACCESS_DENIED",
        ),
    ],
)
def test_provider_error_halts_calls_without_leaking_details(monkeypatch, failure, code):
    calls = []

    def fail(*args, **kwargs):
        calls.append(1)
        raise failure

    monkeypatch.setattr("app.services.cloudflare.urlopen", fail)
    provider = CloudflareProvider(settings(cloudflare_free_plan_confirmed=True))
    with pytest.raises(AIUnavailable) as error:
        provider.generate("context", "question")
    assert error.value.code == code
    assert "private-internal-detail" not in str(error.value)
    assert "test-only-token" not in str(error.value)
    with pytest.raises(AIUnavailable) as second:
        provider.generate("context", "question")
    assert second.value.code == "AI_HALTED"
    assert len(calls) == 1


def test_transport_format_and_local_budget(monkeypatch):
    class Reply:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self, size):
            return b'{"success":true,"result":{"response":"test-only-response"}}'

    calls = []

    def respond(request, **kwargs):
        assert request.full_url.startswith("https://api.cloudflare.com/client/v4/accounts/")
        assert request.get_header("Authorization") == "Bearer test-only-token"
        body = json.loads(request.data)
        assert body["max_tokens"] == 600 and body["stream"] is False
        assert body["response_format"] == {"type": "json_object"}
        calls.append(1)
        return Reply()

    monkeypatch.setattr("app.services.cloudflare.urlopen", respond)
    provider = CloudflareProvider(settings(cloudflare_free_plan_confirmed=True))
    for _ in range(20):
        assert provider.generate("context", "question") == "test-only-response"
    with pytest.raises(AIUnavailable) as error:
        provider.generate("context", "question")
    assert error.value.code == "AI_BUDGET_REACHED" and len(calls) == 20
