"""Regression fixtures for formatting/schema; not live Cloudflare evidence."""

import json

import pytest
from pydantic import ValidationError

from app.services.assistant import ModelAnswer, answer_question, normalize_answer_json
from app.services.cloudflare import AIUnavailable
from test_assistant import StubLlama


@pytest.mark.parametrize(
    "template",
    [
        "  {answer}  ",
        "\ufeff  {answer}\n",
        "```json\n{answer}\n```",
        "```JSON\r\n{answer}\r\n```",
        "````json\n{answer}\n````",
        "~~~json\n{answer}\n~~~",
        "الإجابة بصيغة JSON:\n```json\n{answer}\n```\n",
    ],
)
def test_wrappers_preserve_answer_and_exact_citations(template):
    class Formatted(StubLlama):
        def generate(self, system, question):
            assert "ANSWER JSON SCHEMA:" in system
            assert '"additionalProperties": false' in system
            return template.format(answer=super().generate(system, question))

    answer = answer_question("ما هي سياسة الإجازات؟", Formatted())
    assert answer.status == "answered"
    assert answer.sources
    assert all(source.quote in source.excerpt for source in answer.sources)


def test_multiple_objects_or_blocks_are_not_silently_selected():
    valid = '{"supported":false,"answer":"","citations":[]}'
    for raw in [
        valid + valid,
        f"```json\n{valid}\n```\n```json\n{valid}\n```",
        f"{valid}\n```json\n{valid}\n```",
    ]:
        with pytest.raises(ValidationError):
            ModelAnswer.model_validate_json(normalize_answer_json(raw))


@pytest.mark.parametrize("mode", ["source", "quote", "number"])
def test_wrappers_never_bypass_evidence_validation(mode):
    class Wrapped(StubLlama):
        def generate(self, system, question):
            return "Here is JSON:\n```json\n" + super().generate(system, question) + "\n```"

    with pytest.raises(AIUnavailable) as error:
        answer_question("ما هي سياسة الإجازات؟", Wrapped(mode))
    assert error.value.code == "AI_ANSWER_INVALID"


def test_schema_remains_strict_after_normalization():
    bad = json.dumps(
        {
            "supported": "true",
            "answer": "test fixture",
            "citations": [{"source_id": "S1", "evidence_id": "S1:E1"}],
        }
    )
    with pytest.raises(ValidationError):
        ModelAnswer.model_validate_json(normalize_answer_json("```json\n" + bad + "\n```"))
