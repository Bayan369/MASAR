"""Local prompt/pipeline regressions; not proof of live Llama relevance quality."""

import json

import pytest

from app.config import Settings
from app.services.semantic_search import HybridSearch
from app.services.retrieval import passages
from test_semantic_search import SearchFixture


class RubricFixture(SearchFixture):
    """Deliberately narrowed rewrite; explicit fixture assessments, never runtime logic."""

    relevant = True
    score = 0.7

    def generate(self, prompt, question):
        self.prompts.append(prompt)
        if prompt.startswith("Rewrite"):
            return json.dumps({"query": "working hours"})
        assert prompt.startswith("Rerank")
        assert "search_query is only a retrieval hint" in prompt
        assert "must not narrow or override the original request" in prompt
        assert "Score direct usefulness to the original request, NOT the fraction" in prompt
        assert (
            "incomplete coverage or different wording/language alone is not a reason for score 0"
            in prompt
        )
        assert "a different procedure is not relevant merely because" in prompt
        metadata = json.loads(prompt.split("CANDIDATES JSON:\n", 1)[1])
        self.candidates = metadata["passages"]
        self.original_question = question
        source = next(p for p in passages() if p.id == "employee-handbook:1")
        partial = next(
            candidate
            for candidate in self.candidates
            if candidate["section"] == source.section and candidate["text"] == source.text
        )
        self.partial_reference = partial["id"]
        assert metadata["search_query"] == "working hours"
        return json.dumps(
            {
                "results": [
                    {
                        "id": candidate["id"],
                        "original": {
                            "relevant": self.relevant
                            if candidate["id"] == self.partial_reference
                            else False,
                            "score": self.score
                            if candidate["id"] == self.partial_reference
                            else 0.0,
                        },
                        "rewritten": {"relevant": False, "score": 0.0},
                    }
                    for candidate in self.candidates
                ]
            }
        )


@pytest.mark.parametrize(
    "question",
    [
        "وش المطلوب مني بعد المباشرة؟",
        "Which actions are required when joining?",
        "ما الخطوات المطلوبة لبدء الإجراء؟",
    ],
)
def test_partial_support_is_not_vetoed_by_a_narrowed_rewrite(question):
    provider = RubricFixture()
    trace = []
    settings = Settings(_env_file=None)
    hits = HybridSearch().search(question, [], provider, settings, trace=trace.append)
    assert provider.original_question == question
    assert len(hits) == 1
    assert hits[0].score == 0.7
    assert hits[0].passage.id == "employee-handbook:1"
    decision = next(e for e in trace if e["stage"] == "rerank")
    assert hits[0].passage.id == next(
        row["passage"]
        for row in decision["results"]
        if row["reference"] == provider.partial_reference
    )
    assert decision["omitted"] == []
    assert settings.rerank_min_score == 0.6
    assert len(provider.prompts) == 2


@pytest.mark.parametrize("relevant,score", [(False, 0.9), (True, 0.59)])
def test_rubric_does_not_force_a_document_or_bypass_relevance_and_threshold(relevant, score):
    provider = RubricFixture()
    provider.relevant, provider.score = relevant, score
    hits = HybridSearch().search("طلب إجراء محدد", [], provider, Settings(_env_file=None))
    assert hits == []
