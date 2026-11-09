"""Offline compact transport regressions; no model quality or live-call claims."""

import pytest
from pydantic import ValidationError

from app.services.cloudflare import AIUnavailable
from app.services.semantic_search import (
    CompactRanking,
    expand_ranking,
    checked_ranking,
    structured,
    validate_support,
)
from app.services.retrieval import Passage


def row():
    return ["C1", True, 0.8, "p", [1], [], False, 0.0]


def test_compact_transport_preserves_judgments_and_exact_source_references():
    ranking = expand_ranking(CompactRanking.model_validate({"results": [row()]}))
    original = ranking.results[0].original
    assert original.relevant and original.score == 0.8
    assert original.relation == "partial_support" and original.evidence_ids == ["C1:E1"]
    assert ranking.results[0].rewritten.relevant is False
    checked_ranking(ranking, {"C1": 0})
    validate_support(
        ranking.results, {"C1": 0}, [Passage("p", "d", "T", "S", "Exact evidence.")], {}
    )


@pytest.mark.parametrize(
    "index,value",
    [
        (1, "true"),
        (2, "0.8"),
        (2, True),
        (2, 1.1),
        (3, "unknown"),
        (4, [0]),
        (4, ["1"]),
        (5, [-1]),
        (6, "false"),
        (6, [False, 0]),
        (7, "0.8"),
        (7, True),
        (7, 1.1),
    ],
)
def test_malformed_tuple_fields_still_fail_closed(index, value):
    value_row = row()
    value_row[index] = value
    with pytest.raises(ValidationError):
        CompactRanking.model_validate({"results": [value_row]})


@pytest.mark.parametrize("rows", [[row()[:-1]], [row() + ["extra"]], [row()] * 9])
def test_tuple_arity_and_candidate_bounds_are_strict(rows):
    with pytest.raises(ValidationError):
        CompactRanking.model_validate({"results": rows})


def test_compact_json_is_smaller_without_dropping_assessments():
    rows = [[f"C{i}", True, 0.8, "p", [1], [], False, 0] for i in range(1, 9)]
    compact = CompactRanking.model_validate({"results": rows})
    expanded = expand_ranking(compact)
    # Byte comparison only, not an assertion about the model's tokenizer.
    assert len(compact.model_dump_json()) < len(expanded.model_dump_json()) / 2
    assert len(expanded.results) == 8


def test_truncated_compact_json_does_not_trigger_retry_or_repair(caplog):
    class Broken:
        calls = 0

        def generate(self, *_):
            self.calls += 1
            return '{"results":[["C1",true,0.8,"p",[1],[],false,0]'

    provider = Broken()
    with pytest.raises(AIUnavailable) as error:
        structured(provider, "test", "test", CompactRanking)
    assert error.value.code == "AI_SEARCH_INVALID" and provider.calls == 1
    assert "rag_json_error stage=rerank" in caplog.text


def test_unknown_sentence_index_is_not_a_valid_source():
    value_row = row()
    value_row[4] = [99]
    ranking = expand_ranking(CompactRanking.model_validate({"results": [value_row]}))
    with pytest.raises(AIUnavailable):
        validate_support(ranking.results, {"C1": 0}, [Passage("p", "d", "T", "S", "Evidence.")], {})


def test_generated_schema_has_eight_positions_and_flat_rewritten_fields():
    item = CompactRanking.model_json_schema()["properties"]["results"]["items"]
    assert item["minItems"] == item["maxItems"] == 8
    assert len(item["prefixItems"]) == 8
    assert item["prefixItems"][4]["maxItems"] == 2
    assert item["prefixItems"][5]["maxItems"] == 3
    assert item["prefixItems"][6]["type"] == "boolean"
    assert item["prefixItems"][7] == {"minimum": 0, "maximum": 1, "type": "number"}


@pytest.mark.parametrize("candidate", [0, 1, 3])
@pytest.mark.parametrize(
    "index,value,error_type",
    [
        (4, [1, 2, 3], "too_long"),
        (5, [1, 2, 3, 4], "too_long"),
        (6, [False, 0.2, 9], "bool_type"),
        (7, [False, 0.2], "float_type"),
    ],
)
def test_observed_inner_list_errors_are_rejected_at_the_correct_position(
    candidate, index, value, error_type
):
    rows = [[f"C{i + 1}", True, 0.8, "p", [1], [], False, 0] for i in range(4)]
    rows[candidate][index] = value
    with pytest.raises(ValidationError) as error:
        CompactRanking.model_validate({"results": rows})
    assert any(
        item["type"] == error_type and item["loc"] == ("results", candidate, index)
        for item in error.value.errors(include_input=False)
    )
    assert rows[candidate][index] == value  # No slicing or scalar extraction.


def test_old_nested_pair_and_seven_positions_are_not_auto_upgraded():
    with pytest.raises(ValidationError) as error:
        CompactRanking.model_validate({"results": [["C1", True, 0.8, "p", [1], [], [False, 0]]]})
    errors = error.value.errors(include_input=False)
    assert any(item["loc"] == ("results", 0, 6) and item["type"] == "bool_type" for item in errors)
    assert any(item["loc"] == ("results", 0, 7) and item["type"] == "missing" for item in errors)


@pytest.mark.parametrize(
    "raw",
    [
        '{"results":[["C1",true,0.8,"p",[1],[],false,0]',
        '{"results":[["C1",true,0.8,"p",[1],[],false,0]],}',
        '{"results":[["C1",true,0.8,"p",[1],[],false PRIVATE_TOKEN,0]]}',
    ],
)
def test_invalid_v4_json_keeps_safe_failure_with_no_repair(raw, caplog):
    class Invalid:
        calls = 0

        def generate(self, *_):
            self.calls += 1
            return raw

    provider = Invalid()
    with pytest.raises(AIUnavailable) as error:
        structured(provider, "test", "test", CompactRanking)
    assert error.value.code == "AI_SEARCH_INVALID" and error.value.status == 502
    assert provider.calls == 1
    assert "rag_json_error stage=rerank" in caplog.text
    assert "PRIVATE_TOKEN" not in caplog.text
