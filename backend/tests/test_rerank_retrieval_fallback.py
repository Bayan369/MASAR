"""Offline transport fixtures; no live inference claims."""

import json
import pytest
from app.config import Settings
from app.services.assistant import answer_question
from app.services.cloudflare import AIUnavailable
from app.services.semantic_search import HybridSearch
from test_semantic_search import SearchFixture


class InvalidRerank(SearchFixture):
    def __init__(self, output):
        super().__init__()
        self.output = output

    def generate(self, prompt, question):
        if prompt.startswith("Rewrite"):
            return super().generate(prompt, question)
        self.prompts.append(prompt)
        if isinstance(self.output, Exception):
            raise self.output
        return self.output


@pytest.mark.parametrize(
    "output",
    [
        '{"results":[["C1",true,0.8,"p",[1],[],false,0]',
        '{"results": broken}',
        '{"results":[["C1","yes",0.8,"p",[1],[],false,0]]}',
    ],
)
def test_invalid_transport_retains_original_rrf_order_and_scores(output):
    provider = InvalidRerank(output)
    events = []
    hits = HybridSearch().search(
        "كيف أطلب جهاز العمل؟", [], provider, Settings(_env_file=None), events.append
    )
    selected = [
        row for row in next(e for e in events if e["stage"] == "rrf")["ranking"] if row["selected"]
    ][:3]
    assert [h.passage.id for h in hits] == [row["passage"] for row in selected]
    assert [round(h.score, 6) for h in hits] == [row["score"] for row in selected]
    assert all(h.support_ranges is None and h.support_relation is None for h in hits)
    assert len(provider.prompts) == 2
    assert any(e["stage"] == "rerank_fallback" for e in events)


@pytest.mark.parametrize("code", ["AI_TIMEOUT", "AI_BUDGET_EXHAUSTED"])
def test_provider_failure_propagates(code):
    with pytest.raises(AIUnavailable) as error:
        HybridSearch().search(
            "كيف أبدأ؟",
            [],
            InvalidRerank(AIUnavailable(code, "unavailable", 503)),
            Settings(_env_file=None),
        )
    assert error.value.code == code


@pytest.mark.parametrize("invented", [False, True])
def test_fallback_preserves_final_exact_evidence_validation(invented):
    hits = HybridSearch().search(
        "كيف أطلب جهاز العمل؟", [], InvalidRerank("{"), Settings(_env_file=None)
    )

    class FinalModel:
        settings = Settings(_env_file=None)

        def generate(self, prompt, question):
            source = json.loads(prompt.split("DOCUMENT CONTEXT:\n")[1])[0]
            return json.dumps(
                {
                    "supported": True,
                    "answer": source["evidence"][0]["text"],
                    "citations": [
                        {
                            "source_id": source["source_id"],
                            "evidence_ids": [
                                "S99:E999" if invented else source["evidence"][0]["evidence_id"]
                            ],
                        }
                    ],
                }
            )

    if invented:
        with pytest.raises(AIUnavailable) as error:
            answer_question("كيف أطلب جهاز العمل؟", FinalModel(), retrieved_hits=hits)
        assert error.value.code == "AI_ANSWER_INVALID"
    else:
        answer = answer_question("كيف أطلب جهاز العمل؟", FinalModel(), retrieved_hits=hits)
        assert answer.status == "answered"
        assert answer.sources[0].document_id == hits[0].passage.document_id
        assert answer.sources[0].quote in hits[0].passage.text
