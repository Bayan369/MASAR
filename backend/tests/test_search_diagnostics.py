"""Offline logging-safety regressions; no Cloudflare requests or semantic claims."""

import json

import pytest

from app.services.cloudflare import AIUnavailable
from app.services.semantic_search import IntentRewrite, Ranking, structured
from test_rerank_protocol import assessment


class TextProvider:
    def __init__(self, raw):
        self.raw = raw
        self.calls = 0

    def generate(self, *_):
        self.calls += 1
        return self.raw


def rejected(raw, caplog, schema=Ranking):
    provider = TextProvider(raw)
    with pytest.raises(AIUnavailable) as error:
        structured(provider, "PRIVATE_DOCUMENT", "PRIVATE_QUESTION", schema)
    assert error.value.code == "AI_SEARCH_INVALID"
    assert error.value.status == 502
    assert provider.calls == 1  # No retry, repair or fallback.
    assert "PRIVATE_" not in caplog.text
    return caplog.text


@pytest.mark.parametrize(
    "raw",
    [
        '{"results":[{"id":"PRIVATE_MODEL_TEXT"',
        '{\n"results": [PRIVATE_INVALID_TOKEN]}',
        '{"results": [],}',
        '```json\n{"results": [\n```',
    ],
)
def test_invalid_or_truncated_json_logs_only_type_and_location(raw, caplog):
    from app.services.assistant import normalize_answer_json

    with pytest.raises(json.JSONDecodeError) as parse:
        json.loads(normalize_answer_json(raw))
    log = rejected(raw, caplog)
    assert (
        f"rag_json_error stage=rerank type=json_invalid line={parse.value.lineno} "
        f"column={parse.value.colno}"
    ) in log
    assert "rag_stage_invalid stage=rerank" in log
    assert "rag_schema_error" not in log
    assert "truncation=confirmed" not in log  # Invalid JSON alone does not prove truncation.


def test_missing_original_annotation_logs_field_and_path(caplog):
    result = assessment("C1")
    del result["original"]["relation"]
    log = rejected(json.dumps({"results": [result]}), caplog)
    assert "type=missing field=relation path=results.0.original.relation" in log
    assert "rag_json_error" not in log


@pytest.mark.parametrize(
    "field,value,kind",
    [
        ("relation", "PRIVATE_INVALID_RELATION", "literal_error"),
        ("relevant", "PRIVATE_BOOL", "bool_type"),
        ("score", "PRIVATE_SCORE", "float_type"),
        ("score", 1.1, "less_than_equal"),
        ("score", float("nan"), "finite_number"),
        ("evidence_ids", ["PRIVATE_1", "PRIVATE_2", "PRIVATE_3"], "too_long"),
    ],
)
def test_schema_errors_never_log_rejected_values(field, value, kind, caplog):
    result = assessment("C1")
    result["original"][field] = value
    log = rejected(json.dumps({"results": [result]}), caplog)
    assert f"type={kind} field={field} path=results.0.original.{field}" in log
    assert "rag_json_error" not in log


def test_unknown_fields_are_redacted_in_error_paths(caplog):
    result = assessment("C1")
    result["rewritten"]["PRIVATE_TOKEN_FIELD"] = "PRIVATE_SECRET_VALUE"
    log = rejected(json.dumps({"results": [result]}), caplog)
    assert "type=extra_forbidden field=unknown_field path=results.0.rewritten.unknown_field" in log


def test_rewrite_errors_use_same_safe_diagnostics_and_correct_stage(caplog):
    log = rejected('{"query":"PRIVATE_QUERY","intent":{}}', caplog, IntentRewrite)
    assert "rag_schema_error stage=rewrite type=missing field=request path=intent.request" in log
    assert "rag_stage_invalid stage=rewrite" in log
    assert "stage=rerank" not in log


def test_schema_diagnostics_are_bounded(caplog):
    log = rejected(json.dumps({f"PRIVATE_FIELD_{i}": "PRIVATE_VALUE" for i in range(30)}), caplog)
    assert log.count("rag_schema_error") == 8
    assert "PRIVATE_" not in log


def test_valid_result_is_unchanged_and_does_not_log_errors(caplog):
    payload = {"results": [assessment("C1")]}
    provider = TextProvider(json.dumps(payload))
    assert (
        structured(provider, "PRIVATE_CONTEXT", "PRIVATE_QUESTION", Ranking).model_dump() == payload
    )
    assert provider.calls == 1
    assert not caplog.records


@pytest.mark.parametrize("at_end", [True, False])
def test_column_1505_does_not_by_itself_prove_output_truncation(at_end, caplog):
    from app.services.semantic_search import CompactRanking

    prefix = '{"results":'
    raw = prefix + " " * (1504 - len(prefix))
    if not at_end:
        raw += "PRIVATE_INVALID_TOKEN}"
    # Keep internal whitespace; trailing-only spaces are stripped before parsing.
    if at_end:
        prefix = '{"results":['
        raw = prefix + "0," * ((1504 - len(prefix)) // 2)
        # Exercise parser directly so position/length correspond to the exact input.
        from app.services.semantic_search import log_structured_validation
        from pydantic import ValidationError

        with pytest.raises(ValidationError) as error:
            CompactRanking.model_validate_json(raw)
        log_structured_validation(error.value, raw, "rerank")
    else:
        rejected(raw, caplog, CompactRanking)
    assert "line=1 column=1505" in caplog.text
    assert f"chars={len(raw)} at_end={str(at_end).lower()} syntax=expected_value" in caplog.text
    assert "truncation=confirmed" not in caplog.text and "PRIVATE_" not in caplog.text


def test_json_diagnostic_uses_allowlisted_syntax_not_raw_parser_message(caplog):
    raw = '{"results":"PRIVATE_TEXT\\q"}'
    log = rejected(raw, caplog)
    assert "syntax=invalid_escape" in log
    assert "PRIVATE_TEXT" not in log
