"""Regression fixtures for audited defects; no claim of real model acceptance."""

import json
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.services.cloudflare import AIUnavailable
from app.services.semantic_search import HybridSearch, Ranking, checked_ranking, fuse_candidates
from test_semantic_search import ONBOARDING_ID, SearchFixture
from test_product import COMPANY, CONV, DOC, FakeDB, config, member_app


def test_reranker_complete_assessments_map_to_original_evidence():
    class Subset(SearchFixture):
        def generate(self, prompt, question):
            result = json.loads(super().generate(prompt, question))
            return json.dumps(result)

    provider = Subset()
    hits = HybridSearch().search("سؤال عن بداية العمل", [], provider, Settings(_env_file=None))
    assert len(hits) == 1 and hits[0].passage.id == ONBOARDING_ID
    metadata = json.loads(provider.prompts[-1].split("CANDIDATES JSON:\n", 1)[1])
    ids = [item["id"] for item in metadata["passages"]]
    assert all(value.startswith("C") for value in ids)
    assert metadata["response_schema"]["$defs"]["Relevance"]["properties"]["id"]["enum"] == ids


@pytest.mark.parametrize("ids", [["PRIVATE_UNKNOWN"], ["C1", "C1"], ["C1", "S1"]])
def test_unknown_or_duplicate_ids_are_rejected_without_leaking_values(ids, caplog):
    ranking = Ranking.model_validate(
        {
            "results": [
                {
                    "id": value,
                    "original": {"relevant": True, "score": 0.9},
                    "rewritten": {"relevant": False, "score": 0.0},
                }
                for value in ids
            ]
        }
    )
    with pytest.raises(AIUnavailable) as error:
        checked_ranking(ranking, {"C1": 0, "C2": 1})
    assert error.value.code == "AI_SEARCH_INVALID"
    assert "rag_rank_ids_invalid" in caplog.text
    assert "PRIVATE_UNKNOWN" not in caplog.text


def test_empty_rerank_is_incomplete_without_reusing_discarded_candidates():
    class Empty(SearchFixture):
        def generate(self, prompt, question):
            return (
                '{"results":[]}'
                if prompt.startswith("Rerank")
                else super().generate(prompt, question)
            )

    with pytest.raises(AIUnavailable) as error:
        HybridSearch().search("غير مرتبط", [], Empty(), Settings(_env_file=None))
    assert error.value.code == "AI_SEARCH_INCOMPLETE"


def test_rrf_candidate_cap_does_not_drop_either_branch_leader():
    selected, scores = fuse_candidates(list(range(8)), [8, 1, 2, 3, 4, 5, 6, 7])
    assert len(selected) == 8 and len(set(selected)) == 8
    assert 0 in selected and 8 in selected
    assert scores[1] == pytest.approx(2 / 62)


@pytest.mark.parametrize("mode", ["lexical", "hybrid"])
def test_protected_context_is_loaded_from_owned_conversation_not_client(mode, monkeypatch):
    app, db = member_app()
    app.state.settings = config(retrieval_mode=mode)
    original_rows = db.rows

    def rows(table, **filters):
        if table == "messages" and filters.get("select") == "role,content":
            db.calls.append((table, filters))
            assert filters["company_id"] == "eq." + COMPANY
            assert filters["conversation_id"] == "eq." + CONV
            return [
                {"role": "assistant", "content": "هل تريد معرفة الخطوة التالية؟"},
                {"role": "user", "content": "ما هي سياسة الإجازات؟"},
            ]
        return original_rows(table, **filters)

    db.rows = rows

    def rpc(name, data):
        db.calls.append((name, data))
        return [
            {
                "id": DOC,
                "document_id": DOC,
                "title": "سياسة",
                "section_title": "إجراء",
                "content": "يُرسل الطلب إلى المدير المباشر.",
                "page_number": 2,
                "score": 1.0,
            }
        ]

    db.rpc = rpc
    service = FakeDB()
    monkeypatch.setattr("app.api.chat.Supabase", lambda *args, **kwargs: service)

    class Provider:
        settings = config()

        def generate(self, prompt, question):
            assert "CLIENT_UNTRUSTED_SHOULD_NOT_BE_USED" not in prompt
            assert "ما هي سياسة الإجازات؟" in prompt
            if prompt.startswith("Rewrite"):
                return '{"query":"إجراءات طلب الإجازة"}'
            assert "هل تريد معرفة الخطوة التالية؟" in prompt
            return json.dumps(
                {
                    "supported": True,
                    "answer": "يُرسل الطلب إلى المدير المباشر.",
                    "citations": [{"source_id": "S1", "evidence_ids": ["S1:E1"]}],
                }
            )

        def embed(self, texts):
            assert texts == ["إجراءات طلب الإجازة"]
            return [[1.0] + [0.0] * 1023]

    app.state.ai_provider = Provider()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/assistant/ask",
            json={
                "question": "نعم",
                "conversation_id": CONV,
                "request_id": str(uuid4()),
                "history": [
                    {"role": "assistant", "content": "CLIENT_UNTRUSTED_SHOULD_NOT_BE_USED"}
                ],
            },
        )
        assert response.status_code == 200
        assert response.json()["sources"][0]["chunk_id"] == DOC
        assert response.json()["sources"][0]["quote"] == "يُرسل الطلب إلى المدير المباشر."
    search = next(data for name, data in db.calls if name == "search_chunks")
    assert search["query_text"] == (
        "إجراءات طلب الإجازة" if mode == "hybrid" else "ما هي سياسة الإجازات؟"
    )


def test_unowned_conversation_cannot_load_history_or_call_search():
    app, db = member_app()
    original = db.rows

    def rows(table, **filters):
        if table == "conversations":
            return []
        if table == "messages" and filters.get("select") == "role,content":
            pytest.fail("History must not be read before authorization")
        return original(table, **filters)

    db.rows = rows
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/assistant/ask", json={"question": "نعم", "conversation_id": CONV}
        )
        assert response.status_code == 404
    assert not any(name == "search_chunks" for name, _ in db.calls)


def test_runtime_logs_safe_app_metadata_but_not_http_request_urls(monkeypatch, caplog):
    import logging
    from scripts.start_server import configure_logging

    for name in ("app", "httpx", "httpx2", "httpcore", "httpcore2"):
        logger = logging.getLogger(name)
        monkeypatch.setattr(logger, "level", logger.level)
    caplog.set_level(logging.INFO)
    configure_logging()
    logging.getLogger("httpx2").info("HTTP Request: GET https://PRIVATE_HOST/PRIVATE_DOCUMENT")
    logging.getLogger("httpcore2").debug("PRIVATE_HEADERS")
    logging.getLogger("app.services.semantic_search").info(
        "rag_rank_ids_valid returned=1 omitted=2"
    )
    assert "PRIVATE_" not in caplog.text
    assert "rag_rank_ids_valid returned=1 omitted=2" in caplog.text
