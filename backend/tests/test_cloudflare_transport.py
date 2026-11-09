"""Offline protocol fixtures only; not evidence of real hosted connectivity."""

from email.message import Message
import gzip
from http.client import IncompleteRead
from io import BytesIO
import json
import logging
from urllib.error import HTTPError, URLError
import zlib

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.assistant import answer_question
from app.services.cloudflare import AIUnavailable, CloudflareProvider, MAX_RESPONSE_BYTES
from test_assistant import StubLlama


class Reply:
    status = 200

    def __init__(self, body, encoding=None, content_type="application/json"):
        self.body = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.headers = Message()
        self.headers["Content-Type"] = content_type
        if encoding:
            self.headers["Content-Encoding"] = encoding

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self, size):
        return self.body[:size]


def provider():
    return CloudflareProvider(
        Settings(
            _env_file=None,
            cloudflare_account_id="a" * 32,
            cloudflare_api_token="NEVER_LOG_THIS_TOKEN",
            cloudflare_free_plan_confirmed=True,
        )
    )


@pytest.mark.parametrize(
    "payload",
    [
        {"success": True, "result": {"response": "OK"}},
        {"result": {"response": "OK"}},
        {"response": "OK"},
    ],
)
def test_native_and_rest_success_shapes(monkeypatch, payload):
    def respond(request, timeout):
        assert timeout == 35
        assert request.get_header("Accept") == "application/json"
        assert request.get_header("Accept-encoding") == "identity"
        assert json.loads(request.data)["stream"] is False
        return Reply(payload)

    monkeypatch.setattr("app.services.cloudflare.urlopen", respond)
    assert provider().generate("private prompt", "private question") == "OK"


def test_structured_native_json_answer_is_serialized_not_python_repr(monkeypatch):
    answer = {"supported": False, "answer": "", "citations": []}
    monkeypatch.setattr(
        "app.services.cloudflare.urlopen",
        lambda *a, **k: Reply({"success": True, "result": {"response": answer}}),
    )
    assert json.loads(provider().generate("system", "question")) == answer


@pytest.mark.parametrize("encoding", ["gzip", "deflate", "unlabelled_gzip"])
def test_compressed_response_is_decoded(monkeypatch, encoding):
    raw = json.dumps({"success": True, "result": {"response": "OK"}}).encode()
    compressed = zlib.compress(raw) if encoding == "deflate" else gzip.compress(raw)
    monkeypatch.setattr(
        "app.services.cloudflare.urlopen",
        lambda *a, **k: Reply(compressed, None if encoding == "unlabelled_gzip" else encoding),
    )
    assert provider().generate("system", "question") == "OK"


def test_old_100kb_limit_no_longer_silently_truncates_valid_json(monkeypatch):
    payload = {"success": True, "result": {"response": "OK"}, "metadata": "x" * 110_000}
    monkeypatch.setattr("app.services.cloudflare.urlopen", lambda *a, **k: Reply(payload))
    assert provider().generate("system", "question") == "OK"


@pytest.mark.parametrize(
    "reply,reason",
    [
        (Reply(b""), "empty_http_body"),
        (Reply(b"not json PRIVATE_RESPONSE"), "malformed_json"),
        (Reply(b"<html>PRIVATE_RESPONSE</html>", content_type="text/html"), "html_instead_of_json"),
        (Reply(b"data: PRIVATE_RESPONSE", content_type="text/event-stream"), "unexpected_sse"),
        (Reply([]), "root_not_object"),
        (Reply({"success": True, "result": None}), "result_not_object"),
        (Reply({"success": True, "result": {}}), "response_not_text_or_answer_object"),
        (Reply({"success": True, "result": {"response": ""}}), "empty_model_response"),
        (
            Reply({"success": True, "result": {"response": []}}),
            "response_not_text_or_answer_object",
        ),
        (Reply({"success": "true", "result": {"response": "OK"}}), "invalid_success_flag"),
        (Reply({"other": "PRIVATE_RESPONSE"}), "missing_result_or_response"),
        (Reply(b"bad gzip", encoding="gzip"), "invalid_compression"),
        (Reply(b"bad br", encoding="br"), "unsupported_encoding"),
        (Reply(b"x" * (MAX_RESPONSE_BYTES + 1)), "response_too_large"),
        (
            Reply(gzip.compress(b"x" * (MAX_RESPONSE_BYTES + 1)), encoding="gzip"),
            "decoded_response_too_large",
        ),
    ],
)
def test_format_error_does_not_poison_next_explicit_request(monkeypatch, caplog, reply, reason):
    responses = iter([reply, Reply({"success": True, "result": {"response": "OK"}})])
    calls = []

    def respond(*a, **k):
        calls.append(1)
        return next(responses)

    monkeypatch.setattr("app.services.cloudflare.urlopen", respond)
    caplog.set_level(logging.INFO)
    instance = provider()
    with pytest.raises(AIUnavailable) as error:
        instance.generate("PRIVATE_PROMPT", "PRIVATE_QUESTION")
    assert error.value.code == "AI_PROVIDER_RESPONSE_INVALID" and error.value.status == 502
    assert "reason=" + reason in caplog.text
    assert len(calls) == 1
    assert instance.generate("PRIVATE_PROMPT", "PRIVATE_QUESTION") == "OK"
    assert len(calls) == 2
    for value in [
        "NEVER_LOG_THIS_TOKEN",
        "PRIVATE_RESPONSE",
        "PRIVATE_PROMPT",
        "PRIVATE_QUESTION",
        "a" * 32,
    ]:
        assert value not in caplog.text


@pytest.mark.parametrize(
    "status,code",
    [
        (401, "AI_ACCESS_DENIED"),
        (403, "AI_ACCESS_DENIED"),
        (402, "AI_QUOTA_OR_RATE_LIMIT"),
        (429, "AI_QUOTA_OR_RATE_LIMIT"),
        (500, "AI_PROVIDER_ERROR"),
        (404, "AI_PROVIDER_ERROR"),
    ],
)
def test_http_errors_log_only_safe_codes_and_keep_halt(monkeypatch, caplog, status, code):
    headers = Message()
    headers["Content-Type"] = "application/json"
    headers["Retry-After"] = "15"
    calls = []

    def fail(*a, **k):
        calls.append(1)
        raise HTTPError(
            "https://private-account.invalid",
            status,
            "PRIVATE_REASON",
            headers,
            BytesIO(
                json.dumps(
                    {
                        "success": False,
                        "errors": [{"code": 10000, "message": "NEVER_LOG_THIS_TOKEN PRIVATE_BODY"}],
                    }
                ).encode()
            ),
        )

    monkeypatch.setattr("app.services.cloudflare.urlopen", fail)
    instance = provider()
    with pytest.raises(AIUnavailable) as error:
        instance.generate("PRIVATE_PROMPT", "PRIVATE_QUESTION")
    assert error.value.code == code
    assert f"http_status={status}" in caplog.text and "api_codes=10000" in caplog.text
    assert "retry_after_seconds=15" in caplog.text
    with pytest.raises(AIUnavailable) as blocked:
        instance.generate("system", "question")
    assert blocked.value.code == "AI_HALTED" and len(calls) == 1
    assert "original_code=" + code in caplog.text
    for value in [
        "NEVER_LOG_THIS_TOKEN",
        "PRIVATE_REASON",
        "PRIVATE_BODY",
        "private-account.invalid",
    ]:
        assert value not in caplog.text


def test_http_200_error_envelope_is_not_a_success(monkeypatch, caplog):
    monkeypatch.setattr(
        "app.services.cloudflare.urlopen",
        lambda *a, **k: Reply(
            {"success": False, "errors": [{"code": 3036, "message": "PRIVATE_DETAIL"}]}
        ),
    )
    instance = provider()
    with pytest.raises(AIUnavailable) as error:
        instance.generate("system", "question")
    assert error.value.code == "AI_PROVIDER_ERROR"
    assert "api_error_envelope" in caplog.text and "api_codes=3036" in caplog.text
    assert "PRIVATE_DETAIL" not in caplog.text
    with pytest.raises(AIUnavailable) as halted:
        instance.generate("system", "question")
    assert halted.value.code == "AI_HALTED"


@pytest.mark.parametrize(
    "failure,reason",
    [
        (TimeoutError("PRIVATE_DETAIL"), "timeout"),
        (URLError(TimeoutError("PRIVATE_DETAIL")), "timeout"),
        (
            URLError("Tunnel connection failed: 403 Forbidden PRIVATE_DETAIL"),
            "proxy_tunnel_rejected",
        ),
        (IncompleteRead(b"PRIVATE_DETAIL"), "incomplete_http_body"),
    ],
)
def test_network_error_classification_and_halt(monkeypatch, caplog, failure, reason):
    def fail(*a, **k):
        raise failure

    monkeypatch.setattr("app.services.cloudflare.urlopen", fail)
    instance = provider()
    with pytest.raises(AIUnavailable) as error:
        instance.generate("system", "question")
    assert error.value.code == "AI_CONNECTION_FAILED"
    assert "reason=" + reason in caplog.text and "PRIVATE_DETAIL" not in caplog.text
    with pytest.raises(AIUnavailable) as error:
        instance.generate("system", "question")
    assert error.value.code == "AI_HALTED"


def test_bad_generated_json_returns_502_not_a_false_no_information_200(caplog):
    app = create_app(Settings(_env_file=None, demo_enabled=True, retrieval_mode="lexical"))

    class InvalidBoth(StubLlama):
        def generate(self, *_):
            self.calls += 1
            return "not json"

    app.state.ai_provider = InvalidBoth()
    with TestClient(app) as client:
        response = client.post("/api/v1/demo/ask", json={"question": "How many annual leave days?"})
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "AI_GENERAL_INVALID"
    assert app.state.ai_provider.calls == 2
    assert "json_parse_error" in caplog.text
    assert "not json" not in caplog.text


def test_generic_json_markdown_fence_is_valid():
    class Fenced(StubLlama):
        def generate(self, system, question):
            return "```\n" + super().generate(system, question) + "\n```"

    assert answer_question("How many annual leave days?", Fenced()).status == "answered"


def test_native_structured_search_output_is_serialized_then_validated_by_its_stage(monkeypatch):
    from app.services.semantic_search import Rewrite

    monkeypatch.setattr(
        "app.services.cloudflare.urlopen",
        lambda *_args, **_kwargs: Reply(
            {"success": True, "result": {"response": {"query": "employee onboarding"}}}
        ),
    )
    text = provider().generate("Rewrite query as JSON", "test question")
    assert Rewrite.model_validate_json(text).query == "employee onboarding"
