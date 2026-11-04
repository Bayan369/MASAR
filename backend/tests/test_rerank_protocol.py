"""Offline protocol fixtures only; these tests do not establish live model quality."""

import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.main import create_app
from app.services.cloudflare import AIUnavailable
from app.services.semantic_search import HybridSearch, Ranking, checked_ranking
from test_semantic_search import SearchFixture


def assessment(reference, relevant=True, score=0.8):
    return {"id": reference, "relevant": relevant, "score": score}


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
        Ranking.model_validate({"results": [assessment("C1", score=score)]}).results[0].score
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
