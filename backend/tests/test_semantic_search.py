"""Algorithm fixtures only; not evidence of actual semantic model quality."""

import json
import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app
from app.services.cloudflare import AIUnavailable
from app.services.demo_conversation import answer_demo_question
from app.services.semantic_search import HybridSearch, unit
from app.services.retrieval import passages

from test_assistant import StubLlama

ONBOARDING_ID = next(p.id for p in passages() if "Onboarding" in p.section)


def vector(index):
    return [1.0 if i == index else 0.0 for i in range(1024)]


class SearchFixture:
    def __init__(self):
        self.batches = []
        self.prompts = []
        self.reject = False
        self.bad_ids = False

    def embed(self, texts):
        self.batches.append(texts)
        return [
            vector(0 if "Onboarding and work equipment" in text or len(text) < 100 else 1)
            for text in texts
        ]

    def generate(self, prompt, question):
        self.prompts.append(prompt)
        if prompt.startswith("Rewrite"):
            return json.dumps({"query": "employee onboarding equipment"})
        assert prompt.startswith("Rerank")
        data = json.loads(prompt.split("CANDIDATES JSON:\n", 1)[1])
        return json.dumps(
            {
                "results": [
                    {
                        "id": "invented" if self.bad_ids else p["id"],
                        "original": {
                            "relevant": not self.reject and "Onboarding" in p["section"],
                            "score": 0.95 if "Onboarding" in p["section"] else 0.1,
                        },
                        "rewritten": {"relevant": False, "score": 0.0},
                    }
                    for p in data["passages"]
                ]
            }
        )


def test_vector_search_fusion_rerank_and_cache_without_keyword_match():
    provider = SearchFixture()
    search = HybridSearch()
    settings = Settings(_env_file=None)
    hits = search.search("صياغة مختلفة", [], provider, settings)
    assert hits[0].passage.id == ONBOARDING_ID
    assert len(provider.batches) == 3
    assert all(len(batch) <= 8 for batch in provider.batches)
    search.search("صياغة أخرى", [], provider, settings)
    assert len(provider.batches) == 4


def test_context_used_by_rewriter_and_original_question_by_reranker():
    provider = SearchFixture()
    history = [
        {"role": "user", "content": "سؤال سابق"},
        {"role": "assistant", "content": "هل تريد الخطوة التالية؟"},
    ]
    HybridSearch().search("إيه", history, provider, Settings(_env_file=None))
    assert "هل تريد الخطوة التالية؟" in provider.prompts[0]
    assert '"history"' in provider.prompts[1]
    assert "ORIGINAL" in provider.prompts[1]


def test_unrelated_candidates_rejected_and_unknown_ids_fail_closed():
    provider = SearchFixture()
    provider.reject = True
    search = HybridSearch()
    assert search.search("سؤال غير مرتبط", [], provider, Settings(_env_file=None)) == []
    provider.bad_ids = True
    with pytest.raises(AIUnavailable) as error:
        search.search("سؤال", [], provider, Settings(_env_file=None))
    assert error.value.code == "AI_SEARCH_INVALID"


def test_embedding_failures_never_fall_back_to_lexical():
    class Failed(SearchFixture):
        def embed(self, _):
            raise AIUnavailable("AI_ACCESS_DENIED", "test failure")

    with pytest.raises(AIUnavailable):
        HybridSearch().search("كيف أطلب إجازة؟", [], Failed(), Settings(_env_file=None))
    for bad in [[0.0] * 1024, [float("nan")] * 1024, [1.0] * 3]:
        with pytest.raises(AIUnavailable):
            unit(bad)


def test_greetings_bypass_semantic_calls():
    for greeting in ["هاي", "هلا", "أهلًا", "مرحبا", "السلام عليكم", "كيفك"]:
        provider = SearchFixture()
        assert (
            answer_demo_question(
                greeting, provider, [], HybridSearch(), Settings(_env_file=None)
            ).status
            == "conversational"
        )
        assert provider.batches == [] and provider.prompts == []


def test_source_links_point_to_actual_rag_documents():
    app = create_app(Settings(_env_file=None, demo_enabled=True, retrieval_mode="lexical"))
    app.state.ai_provider = StubLlama()
    with TestClient(app) as client:
        answer = client.post(
            "/api/v1/demo/ask", json={"question": "كم مدة الإجازة السنوية؟"}
        ).json()
        source = answer["sources"][0]
        url = source["url"].replace("/api/demo/", "/api/v1/demo/")
        document = client.get(url)
        assert document.status_code == 200
        assert source["quote"] in document.text
        assert client.get("/api/v1/demo/documents/unknown").status_code == 404


def test_real_api_hybrid_route_uses_pipeline_and_validates_selected_evidence():
    class Integrated(SearchFixture):
        settings = Settings(_env_file=None)

        def generate(self, prompt, question):
            if prompt.startswith(("Rewrite", "Rerank")):
                return super().generate(prompt, question)
            context = json.loads(prompt.split("DOCUMENT CONTEXT:\n", 1)[1])
            source = context[0]
            evidence = source["evidence"][0]
            return json.dumps(
                {
                    "supported": True,
                    "answer": evidence["text"],
                    "citations": [
                        {
                            "source_id": source["source_id"],
                            "evidence_ids": [evidence["evidence_id"]],
                        }
                    ],
                }
            )

    app = create_app(Settings(_env_file=None, demo_enabled=True, retrieval_mode="hybrid"))
    fixture = Integrated()
    app.state.ai_provider = fixture
    with TestClient(app) as client:
        response = client.post("/api/v1/demo/ask", json={"question": "سؤال عن البداية"})
        assert response.status_code == 200
        assert response.json()["sources"][0]["document_id"] == "employee-handbook"
        assert fixture.batches


def test_corpus_change_rebuilds_vectors_and_invalid_rewrite_stops_before_embedding():
    from dataclasses import replace

    provider = SearchFixture()
    search = HybridSearch()
    corpus = passages()
    search.index(provider, corpus)
    calls = len(provider.batches)
    modified = (replace(corpus[0], text=corpus[0].text + "\nAdditional test text."),) + corpus[1:]
    search.index(provider, modified)
    assert len(provider.batches) == calls + 2

    class Invalid(SearchFixture):
        def generate(self, *_):
            return '{"query":123,"unexpected":"test-only"}'

    invalid = Invalid()
    with pytest.raises(AIUnavailable) as error:
        search.search("test query", [], invalid, Settings(_env_file=None))
    assert error.value.code == "AI_SEARCH_INVALID"
    assert invalid.batches == []
