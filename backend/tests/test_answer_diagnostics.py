"""Synthetic offline fixtures verify logging safety, never real AI connectivity."""

import json
import logging

import pytest

from app.services.assistant import answer_question
from app.services.cloudflare import AIUnavailable, finish_diagnostic
from test_assistant import StubLlama
from test_cloudflare_transport import Reply, provider


class TextOutput(StubLlama):
    def __init__(self, text):
        self.text = text

    def generate(self, *_):
        return self.text


def test_json_error_logs_only_line_and_column(caplog):
    raw = '{"supported": true,\n"answer": "PRIVATE_MODEL_TEXT"'
    with pytest.raises(json.JSONDecodeError) as parse:
        json.loads(raw)
    with pytest.raises(AIUnavailable) as error:
        answer_question("ما هي سياسة الإجازات؟", TextOutput(raw))
    assert error.value.code == "AI_ANSWER_INVALID"
    assert error.value.status == 502
    assert f"llama_json_error line={parse.value.lineno} column={parse.value.colno}" in caplog.text
    assert "reason=json_parse_error" in caplog.text
    assert "PRIVATE_MODEL_TEXT" not in caplog.text
    assert "llama_schema_error" not in caplog.text


def test_schema_errors_log_allowlisted_paths_without_inputs_or_dynamic_keys(caplog):
    raw = json.dumps(
        {
            "supported": "PRIVATE_BOOL_INPUT",
            "answer": {"PRIVATE_DOCUMENT": "PRIVATE_CONTENT"},
            "citations": [{"source_id": "S1", "evidence_ids": []}],
            "PRIVATE_FIELD_NAME": "PRIVATE_SECRET",
        }
    )
    with pytest.raises(AIUnavailable) as error:
        answer_question("ما هي سياسة الإجازات؟", TextOutput(raw))
    assert error.value.code == "AI_ANSWER_INVALID"
    assert "type=bool_type path=supported" in caplog.text
    assert "type=string_type path=answer" in caplog.text
    assert "type=too_short path=citations.0.evidence_ids" in caplog.text
    assert "type=extra_forbidden path=unknown_field" in caplog.text
    assert "reason=schema_validation_error" in caplog.text
    assert "PRIVATE_" not in caplog.text
    assert "llama_json_error" not in caplog.text


@pytest.mark.parametrize(
    "reason,truncation",
    [
        ("length", "confirmed"),
        ("max_tokens", "confirmed"),
        ("stop", "not_reported"),
        (None, "unknown"),
        ("PRIVATE_FINISH_VALUE", "unknown"),
    ],
)
def test_success_transport_logs_safe_metadata_only(monkeypatch, caplog, reason, truncation):
    result = {"response": "PRIVATE_GENERATED_CONTENT"}
    if reason is not None:
        result["finish_reason"] = reason
    monkeypatch.setattr(
        "app.services.cloudflare.urlopen",
        lambda *_args, **_kwargs: Reply({"success": True, "result": result}),
    )
    caplog.set_level(logging.INFO)
    assert (
        provider().generate("PRIVATE_DOCUMENT_CONTENT", "PRIVATE_QUESTION")
        == "PRIVATE_GENERATED_CONTENT"
    )
    assert "workers_ai_success http_status=200 shape=rest_envelope chars=" in caplog.text
    assert "elapsed_ms=" in caplog.text
    assert f"truncation={truncation}" in caplog.text
    if reason is None:
        assert "finish_reason=unavailable" in caplog.text
    elif reason == "PRIVATE_FINISH_VALUE":
        assert "finish_reason=unrecognized" in caplog.text
    else:
        assert f"finish_reason={reason}" in caplog.text
    for value in ["PRIVATE_", "NEVER_LOG_THIS_TOKEN", "a" * 32, "Authorization"]:
        assert value not in caplog.text


def test_finish_metadata_is_not_inferred_from_output_size():
    assert finish_diagnostic({"response": "x" * 50000}) == ("unavailable", "unknown")
    assert finish_diagnostic({"response": "text", "finish_reason": {"secret": "hidden"}}) == (
        "unrecognized",
        "unknown",
    )
