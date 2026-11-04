"""Local citation fixtures: no live calls, post-hoc grouping, truncation or fabricated references."""

import json

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.services.assistant import Citation, ModelAnswer, answer_question
from app.services.cloudflare import AIUnavailable
from app.services.retrieval import Hit, Passage

TEXT = "Send the form.\nThe manager reviews it.\nHR records approval.\nRetain confirmation.\nArchive the request."


def hits():
    return [
        Hit(Passage(f"chunk-{i}", f"doc-{i}", f"Document {i}", "Procedure", TEXT), 0.9)
        for i in range(1, 4)
    ]


class OutputFixture:
    settings = Settings(_env_file=None)

    def __init__(self, citations):
        self.citations = citations
        self.prompt = None

    def generate(self, prompt, question):
        self.prompt = prompt
        return json.dumps(
            {"supported": True, "answer": "Send the form.", "citations": self.citations}
        )


def citation(source, *evidence):
    return {"source_id": source, "evidence_ids": list(evidence)}


def test_oversized_citations_are_rejected_not_truncated_or_merged(caplog):
    provider = OutputFixture([citation("S1", f"S1:E{i}") for i in range(1, 5)])
    with pytest.raises(AIUnavailable) as error:
        answer_question("Explain the procedure", provider, retrieved_hits=hits())
    assert error.value.code == "AI_ANSWER_INVALID"
    assert "type=too_long path=citations" in caplog.text
    assert "Send the form" not in caplog.text


def test_valid_grouped_evidence_preserves_all_exact_quotations_and_mapping():
    provider = OutputFixture([citation("S1", "S1:E1", "S1:E2", "S1:E3", "S1:E4")])
    answer = answer_question("Explain the procedure", provider, retrieved_hits=hits())
    assert answer.status == "answered"
    assert len(answer.sources) == 1
    source = answer.sources[0]
    assert source.document_id == "doc-1"
    assert source.quote == "\n".join(TEXT.splitlines()[:4])
    assert source.quote in source.excerpt
    assert source.id == "S1:E1-S1:E4"
    schema = json.loads(
        provider.prompt.split("ANSWER JSON SCHEMA:\n", 1)[1].split("\nDOCUMENT CONTEXT:\n", 1)[0]
    )
    assert schema["properties"]["citations"]["maxItems"] == 2
    fields = schema["$defs"]["Citation"]["properties"]
    assert fields["source_id"]["enum"] == ["S1", "S2", "S3"]
    assert fields["evidence_ids"]["maxItems"] == 4
    assert fields["evidence_ids"]["uniqueItems"] is True
    assert "grouped by source, NOT by sentence" in provider.prompt
    assert "never repeat its source_id" in provider.prompt


def test_single_available_source_bounds_generation_without_changing_validator():
    provider = OutputFixture([citation("S1", "S1:E1")])
    answer_question("Explain the procedure", provider, retrieved_hits=hits()[:1])
    schema = json.loads(
        provider.prompt.split("ANSWER JSON SCHEMA:\n", 1)[1].split("\nDOCUMENT CONTEXT:\n", 1)[0]
    )
    assert schema["properties"]["citations"]["maxItems"] == 1
    assert schema["$defs"]["Citation"]["properties"]["source_id"]["enum"] == ["S1"]
    assert ModelAnswer.model_json_schema()["properties"]["citations"]["maxItems"] == 3
    assert Citation.model_json_schema()["properties"]["evidence_ids"]["maxItems"] == 4


def test_existing_three_source_validation_limit_is_not_raised_or_removed():
    provider = OutputFixture([citation(f"S{i}", f"S{i}:E1") for i in range(1, 4)])
    assert (
        len(answer_question("Explain the procedure", provider, retrieved_hits=hits()).sources) == 3
    )
    with pytest.raises(ValidationError):
        ModelAnswer.model_validate(
            {
                "supported": True,
                "answer": "test",
                "citations": [citation(f"S{i}", f"S{i}:E1") for i in range(1, 5)],
            }
        )


@pytest.mark.parametrize(
    "citations,reason",
    [
        ([citation("S1", "S1:E1"), citation("S1", "S1:E2")], "duplicate_source_citation"),
        ([citation("S1", "S2:E1")], "unknown_or_cross_source_evidence_id"),
        ([citation("S99", "S99:E1")], "unknown_source_id"),
        ([citation("S1", "S1:E1", "S1:E1")], "duplicate_evidence_id"),
    ],
)
def test_grouping_does_not_bypass_authenticity(citations, reason, caplog):
    with pytest.raises(AIUnavailable) as error:
        answer_question("Explain the procedure", OutputFixture(citations), retrieved_hits=hits())
    assert error.value.code == "AI_ANSWER_INVALID"
    assert f"reason={reason}" in caplog.text


def test_five_evidence_ids_in_one_group_still_fail_schema(caplog):
    with pytest.raises(AIUnavailable):
        answer_question(
            "Explain the procedure",
            OutputFixture([citation("S1", *(f"S1:E{i}" for i in range(1, 6)))]),
            retrieved_hits=hits(),
        )
    assert "type=too_long path=citations.0.evidence_ids" in caplog.text
