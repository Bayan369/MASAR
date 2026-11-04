"""Offline protocol fixtures only; these tests do not establish live model quality."""

import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.main import create_app
from app.services.cloudflare import AIUnavailable
from app.services.semantic_search import HybridSearch, Ranking, checked_ranking
from test_semantic_search import SearchFixture, original_assessment


def assessment(reference, relevant=True, score=0.8):
    return {
        "id": reference,
        "original": original_assessment(reference, relevant, score),
        "rewritten": {"relevant": False, "score": 0.0},
    }


def test_complete_assessments_include_explicit_negative_and_preserve_references():
    ranking = Ranking.model_validate(
        {"results": [assessment("C2", False, 0.2), assessment("C1", True, 0.8)]}
    )
    assert checked_ranking(ranking, {"C1": 7, "C2": 3}) == ranking.results


@pytest.mark.parametrize("results", [[], [assessment("C1")]])
def test_missing_assessments_are_incomplete_not_irrelevant(results, caplog):
    with pytest.raises(AIUnavailable) as error:
        checked_ranking(Ranking.model_validate({"results": results}), {"C1": 0, "C2": 1})
    assert error.value.code == "AI_SEARCH_INCOMPLETE"
    assert error.value.status == 502
    assert "rag_rank_incomplete" in caplog.text
    assert "rag_rank_ids_valid" not in caplog.text


@pytest.mark.parametrize("references", [["C1", "C1"], ["C1", "PRIVATE_UNKNOWN"], ["C1", "S1"]])
def test_invalid_references_take_priority_over_missing_assessments(references, caplog):
    ranking = Ranking.model_validate({"results": [assessment(ref) for ref in references]})
    with pytest.raises(AIUnavailable) as error:
        checked_ranking(ranking, {"C1": 0, "C2": 1})
    assert error.value.code == "AI_SEARCH_INVALID"
    assert "PRIVATE_UNKNOWN" not in caplog.text


@pytest.mark.parametrize("relevant", ["true", "false", 1, 0, None])
def test_relevance_requires_real_boolean(relevant):
    with pytest.raises(ValidationError):
        Ranking.model_validate({"results": [assessment("C1", relevant)]})


@pytest.mark.parametrize(
    "score", [True, False, "0.9", -0.1, 1.1, float("nan"), float("inf"), -float("inf"), None]
)
def test_score_requires_finite_numeric_value_between_zero_and_one(score):
    with pytest.raises(ValidationError):
        Ranking.model_validate({"results": [assessment("C1", score=score)]})


@pytest.mark.parametrize("score", [0, 1, 0.6])
def test_valid_numeric_scores_remain_accepted(score):
    assert (
        Ranking.model_validate({"results": [assessment("C1", score=score)]})
        .results[0]
        .original.score
        == score
    )


class PartialSupportFixture(SearchFixture):
    score = 0.65

    def generate(self, prompt, question):
        if not prompt.startswith("Rerank"):
            return super().generate(prompt, question)
        self.prompts.append(prompt)
        assert "EVERY supplied candidate" in prompt
        assert "relevant part of the requested procedure" in prompt
        assert "does not cover the complete workflow" in prompt
        data = json.loads(prompt.split("CANDIDATES JSON:\n", 1)[1])
        candidates = data["passages"]
        bounds = data["response_schema"]["properties"]["results"]
        assert bounds["minItems"] == bounds["maxItems"] == len(candidates)
        return json.dumps(
            {
                "results": [
                    assessment(p["id"], index == 0, self.score if index == 0 else 0.1)
                    for index, p in enumerate(candidates)
                ]
            }
        )


@pytest.mark.parametrize("score,selected", [(0.59, False), (0.6, True), (0.65, True)])
def test_partial_relevant_evidence_obeys_unchanged_threshold_and_original_mapping(score, selected):
    provider = PartialSupportFixture()
    provider.score = score
    events = []
    settings = Settings(_env_file=None)
    assert settings.rerank_min_score == 0.6
    hits = HybridSearch().search(
        "طلب إجراء له عدة أجزاء", [], provider, settings, trace=events.append
    )
    rerank = next(event for event in events if event["stage"] == "rerank")
    assert rerank["omitted"] == []
    assert bool(hits) is selected
    if selected:
        reference = next(item for item in rerank["results"] if item["reference"] == "C1")
        assert hits[0].passage.id == reference["passage"]
    assert len(provider.prompts) == 2  # No extra inference or repair attempt.


def test_incomplete_api_response_is_error_never_not_found_or_fallback():
    class Missing(SearchFixture):
        def generate(self, prompt, question):
            result = json.loads(super().generate(prompt, question))
            if prompt.startswith("Rerank"):
                result["results"] = result["results"][:-1]
            return json.dumps(result)

    app = create_app(Settings(_env_file=None, demo_enabled=True, retrieval_mode="hybrid"))
    provider = Missing()
    app.state.ai_provider = provider
    with TestClient(app) as client:
        response = client.post("/api/v1/demo/ask", json={"question": "طلب إجراء عام"})
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "AI_SEARCH_INCOMPLETE"
    assert "answer" not in response.json()
    assert len(provider.prompts) == 2


@pytest.mark.parametrize("view", ["original", "rewritten"])
@pytest.mark.parametrize("field", ["relevant", "score"])
def test_each_view_requires_complete_assessment(view, field):
    value = assessment("C1")
    del value[view][field]
    with pytest.raises(ValidationError):
        Ranking.model_validate({"results": [value]})


@pytest.mark.parametrize("view", ["original", "rewritten"])
@pytest.mark.parametrize(
    "invalid",
    [
        {"relevant": "true", "score": 0.8},
        {"relevant": True, "score": "0.8"},
        {"relevant": True, "score": float("nan")},
        {"relevant": True, "score": 1.1},
    ],
)
def test_both_views_validate_types_and_bounds(view, invalid):
    value = assessment("C1")
    value[view] = invalid
    with pytest.raises(ValidationError):
        Ranking.model_validate({"results": [value]})


@pytest.mark.parametrize("view", ["original", "rewritten"])
def test_missing_view_is_invalid_not_inferred(view):
    value = assessment("C1")
    del value[view]
    with pytest.raises(ValidationError):
        Ranking.model_validate({"results": [value]})


class DualViewFixture(SearchFixture):
    assessments = []

    def generate(self, prompt, question):
        if not prompt.startswith("Rerank"):
            return super().generate(prompt, question)
        self.prompts.append(prompt)
        metadata = json.loads(prompt.split("CANDIDATES JSON:\n", 1)[1])
        self.metadata = metadata
        self.user_question = question
        assert "correlated judgments" in prompt
        assert "including short confirmations and ellipsis" in prompt
        self.references = [p["id"] for p in metadata["passages"]]
        return json.dumps(
            {
                "results": [
                    {
                        "id": ref,
                        "original": original_assessment(ref, values[0], values[1]),
                        "rewritten": {"relevant": values[2], "score": values[3]},
                    }
                    for index, ref in enumerate(self.references)
                    for values in [
                        self.assessments[index]
                        if index < len(self.assessments)
                        else (False, 0.0, False, 0.0)
                    ]
                ]
            }
        )


@pytest.mark.parametrize(
    "original,rewritten,selected",
    [
        ((True, 0.7), (False, 0.0), True),
        ((False, 0.9), (True, 1.0), False),
        ((True, 0.59), (True, 1.0), False),
        ((True, 0.6), (False, 0.0), True),
    ],
)
def test_only_original_view_controls_eligibility(original, rewritten, selected):
    provider = DualViewFixture()
    provider.assessments = [(*original, *rewritten)]
    events = []
    hits = HybridSearch().search(
        "A procedural request", [], provider, Settings(_env_file=None), trace=events.append
    )
    assert bool(hits) is selected
    if selected:
        assert hits[0].score == original[1]
    event = next(e for e in events if e["stage"] == "rerank")
    assert event["results"][0]["original"] == original_assessment("C1", *original)
    assert event["results"][0]["rewritten"] == {"relevant": rewritten[0], "score": rewritten[1]}
    assert event["omitted"] == []
    assert len(provider.prompts) == 2


def test_original_score_precedes_rewrite_and_false_rewrite_score_is_not_used():
    provider = DualViewFixture()
    provider.assessments = [
        (True, 0.7, False, 1.0),
        (True, 0.7, True, 0.3),
        (True, 0.8, False, 0.0),
        (False, 0.95, True, 1.0),  # Shared-topic hard negative cannot be rescued.
    ]
    events = []
    hits = HybridSearch().search(
        "Requested action", [], provider, Settings(_env_file=None), trace=events.append
    )
    rows = next(e for e in events if e["stage"] == "rerank")["results"]
    by_ref = {row["reference"]: row["passage"] for row in rows}
    assert [hit.passage.id for hit in hits] == [by_ref[provider.references[i]] for i in [2, 1, 0]]
    assert [hit.score for hit in hits] == [0.8, 0.7, 0.7]


@pytest.mark.parametrize("question", ["إيه", "نعم", "أكيد", "What about the next step?"])
def test_original_view_preserves_followup_and_context(question):
    history = [
        {"role": "user", "content": "How do I request equipment?"},
        {"role": "assistant", "content": "Do you want the next step?"},
    ]
    provider = DualViewFixture()
    HybridSearch().search(question, history, provider, Settings(_env_file=None))
    assert provider.metadata["original_question"] == provider.user_question == question
    assert provider.metadata["history"] == history
    assert provider.metadata["search_query"] != question
    assert len(provider.prompts) == 2
