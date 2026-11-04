"""Offline evidence-policy contracts, NOT proof of live Llama semantic judgments.

Model decisions are explicit inputs. These tests check grounding/applicability,
not language understanding. Runtime has no question/document-specific decisions.
"""

import json
from dataclasses import replace

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.services.assistant import answer_question
from app.services.cloudflare import AIUnavailable
from app.services.evidence import evidence_spans
from app.services.retrieval import Hit, Passage
from app.services.semantic_search import (
    Condition,
    HybridSearch,
    OriginalAssessment,
    PROTOCOL,
    Ranking,
    checked_ranking,
    resolve_intent,
    rewrite_query,
    validate_support,
)
from test_semantic_search import intent_result, original_assessment, vector

# Independent fixture corpus. These names never appear in production selection logic.
CORPUS = (
    Passage(
        "equipment:1",
        "equipment",
        "Equipment",
        "Starting work",
        "يرسل الموظف الجديد طلب جهاز العمل إلى IT مع نسخة للمدير. "
        "يتضمن الطلب القسم وتاريخ بدء العمل. لا تذكر الوثيقة بقية إجراءات المباشرة.",
    ),
    Passage(
        "network:1",
        "network",
        "Network",
        "Remote access",
        "عند الحاجة للاتصال عن بعد، يطلب الموظف صلاحية VPN مع موافقة المدير.",
    ),
    Passage(
        "organization:1",
        "organization",
        "Organization",
        "Background",
        "قسم IT جزء من الشركة ويقدم خدمات تقنية للموظفين.",
    ),
)


class PolicyFixture:
    """Scripted provider for deterministic contracts; no network implementation."""

    def __init__(self, decisions=None, conditions=None, history=None):
        self.settings = Settings(_env_file=None)
        self.decisions = decisions or {}
        self.conditions = conditions or []
        self.history = history or []
        self.prompts = []
        self.batches = []
        self.rerank_input = None
        self.answer_input = None

    def embed(self, texts):
        self.batches.append(texts)
        return [vector(0) for _ in texts]

    def generate(self, prompt, question):
        self.prompts.append((prompt, question))
        if prompt.startswith("Rewrite"):
            data = json.loads(prompt.split("CONTEXT JSON:\n", 1)[1])
            assert data["history"] == self.history
            self.intent_input = data
            result = intent_result("standalone procedure request", question)
            result["intent"]["conditions"] = self.conditions
            return json.dumps(result)
        if prompt.startswith("Rerank"):
            self.rerank_input = json.loads(prompt.split("CANDIDATES JSON:\n", 1)[1])
            assert self.rerank_input["original_question"] == question
            assert self.rerank_input["history"] == self.history
            assert self.rerank_input["protocol"] == PROTOCOL
            results = []
            for p in self.rerank_input["passages"]:
                view = original_assessment(p["id"], False, 0.0)
                decision = self.decisions.get(p["title"])
                if decision:
                    relation, prerequisites, relevant, score = decision
                    view.update(
                        relevant=relevant,
                        score=score,
                        relation=relation,
                        evidence_ids=[p["sentences"][0]["id"]],
                        condition_ids=prerequisites,
                    )
                results.append(
                    {"id": p["id"], "original": view, "rewritten": {"relevant": True, "score": 1.0}}
                )
            return json.dumps({"results": results})
        self.answer_input = json.loads(prompt.split("DOCUMENT CONTEXT:\n", 1)[1])
        assert "state that limitation" in prompt
        assert "not universal obligations" in prompt
        source = self.answer_input[0]
        evidence = source["evidence"][0]
        return json.dumps(
            {
                "supported": True,
                "answer": evidence["text"],
                "citations": [
                    {"source_id": source["source_id"], "evidence_ids": [evidence["evidence_id"]]}
                ],
            }
        )


@pytest.fixture
def corpus(monkeypatch):
    monkeypatch.setattr("app.services.semantic_search.passages", lambda: CORPUS)
    return CORPUS


def prerequisite(status="confirmed", evidence="U0:E1"):
    return {"condition": "الحاجة إلى الاتصال عن بعد", "status": status, "evidence_id": evidence}


@pytest.mark.parametrize(
    "question,relation",
    [
        ("وش المطلوب مني بعد المباشرة؟", "partial_support"),
        ("كيف أطلب جهاز العمل؟", "direct_support"),
        ("What should a new employee do when starting work?", "partial_support"),
    ],
)
def test_direct_or_useful_partial_support_is_bounded_to_original_sentences(
    corpus, question, relation
):
    provider = PolicyFixture(
        {
            "Equipment": (relation, [], True, 0.8),
            "Network": ("conditional_support", [], True, 0.95),
            "Organization": ("background_only", [], True, 0.99),
        }
    )
    settings = Settings(_env_file=None)
    events = []
    hits = HybridSearch().search(question, [], provider, settings, trace=events.append)
    assert [h.passage for h in hits] == [corpus[0]]
    assert hits[0].support_relation == relation
    answer = answer_question(question, provider, hits)
    assert answer.status == "answered"
    assert answer.sources[0].quote == evidence_spans("C1", corpus[0].text)[0].text
    assert answer.sources[0].quote in corpus[0].text
    assert len(provider.answer_input[0]["evidence"]) == 1
    assert provider.answer_input[0]["support_relation"] == relation
    assert len(provider.prompts) == 3  # Existing rewrite/rerank/answer calls.
    assert len(provider.batches) == 2  # One fixture index batch + existing query batch.
    assert settings.ai_call_budget == 20 and settings.rerank_min_score == 0.6
    trace = json.dumps(events, ensure_ascii=False)
    assert question not in trace and corpus[0].text not in trace
    assert PROTOCOL in trace


@pytest.mark.parametrize(
    "question,conditions,refs,selected",
    [
        ("أحتاج الاتصال عن بعد، كيف أطلب VPN؟", [prerequisite()], ["K1"], True),
        ("لا أحتاج الاتصال عن بعد، هل VPN مطلوب؟", [prerequisite("denied")], ["K1"], False),
        ("هل يلزمني VPN؟", [prerequisite("unknown", None)], ["K1"], False),
        ("وش إجراءات بداية العمل؟", [], [], False),
        ("أحتاج الاتصال عن بعد", [prerequisite()], [], False),
        (
            "أحتاج الاتصال عن بعد",
            [prerequisite(), prerequisite("unknown", None)],
            ["K1", "K2"],
            False,
        ),
    ],
)
def test_conditional_procedure_requires_all_prerequisites_confirmed(
    corpus, question, conditions, refs, selected
):
    provider = PolicyFixture({"Network": ("conditional_support", refs, True, 0.95)}, conditions)
    hits = HybridSearch().search(question, [], provider, Settings(_env_file=None))
    assert bool(hits) is selected
    if selected:
        assert hits[0].passage == corpus[1]
        assert hits[0].support_relation == "conditional_support"
    else:
        answer = answer_question(question, provider, hits)
        assert answer.status == "not_found" and not answer.sources
        assert len(provider.prompts) == 2  # No answer call or fallback without evidence.


@pytest.mark.parametrize("relation", ["background_only", "no_support"])
def test_related_background_cannot_be_rescued_by_high_scores(corpus, relation):
    provider = PolicyFixture({"Organization": (relation, [], True, 1.0)})
    assert HybridSearch().search("ما المطلوب مني؟", [], provider, Settings(_env_file=None)) == []


@pytest.mark.parametrize("relevant,score", [(False, 0.95), (True, 0.59)])
def test_evidence_annotations_never_override_original_decision(corpus, relevant, score):
    provider = PolicyFixture({"Equipment": ("partial_support", [], relevant, score)})
    assert HybridSearch().search("طلب إجراء", [], provider, Settings(_env_file=None)) == []


def test_followup_resolves_from_history_but_conditions_require_user_provenance(corpus):
    history = [
        {"role": "user", "content": "أحتاج الاتصال عن بعد للعمل."},
        {"role": "assistant", "content": "هل تريد معرفة طريقة طلب الصلاحية؟"},
    ]
    provider = PolicyFixture(
        {"Network": ("conditional_support", ["K1"], True, 0.8)},
        [prerequisite(evidence="U1:E1")],
        history,
    )
    hits = HybridSearch().search("إيه", history, provider, Settings(_env_file=None))
    assert hits[0].passage == corpus[1]
    assert provider.rerank_input["original_question"] == "إيه"
    assert provider.rerank_input["intent"]["conditions"]["K1"]["evidence_id"] == "U1:E1"
    assert provider.rerank_input["user_evidence"] == [
        {"id": "U1:E1", "text": history[0]["content"]}
    ]
    user_texts = {item["text"] for item in provider.intent_input["user_evidence"]}
    assert history[0]["content"] in user_texts
    assert history[1]["content"] not in user_texts
    assert len(provider.prompts) == 2


@pytest.mark.parametrize(
    "status,evidence",
    [
        ("confirmed", None),
        ("confirmed", "U9:E1"),
        ("denied", "C1:E1"),
        ("unknown", "U0:E1"),
        ("confirmed", "U1:E1"),
    ],
)
def test_invented_or_assistant_only_condition_proof_fails_closed(status, evidence, caplog):
    provider = PolicyFixture(conditions=[prerequisite(status, evidence)])
    with pytest.raises(AIUnavailable) as error:
        resolve_intent("موضوع المستخدم", [], provider)
    assert error.value.code == "AI_SEARCH_INVALID"
    assert "موضوع المستخدم" not in caplog.text and "الحاجة" not in caplog.text


@pytest.mark.parametrize(
    "evidence_ids,condition_ids,relation",
    [
        (["C2:E1"], [], "partial_support"),
        (["C1:E999"], [], "direct_support"),
        (["C1:E1", "C1:E1"], [], "partial_support"),
        ([], [], "partial_support"),
        (["C1:E1"], ["K99"], "conditional_support"),
        (["C1:E1"], ["K1", "K1"], "conditional_support"),
        (["C1:E1"], ["K1"], "direct_support"),
    ],
)
def test_sentence_and_condition_references_are_source_bound(evidence_ids, condition_ids, relation):
    original = original_assessment("C1")
    original.update(evidence_ids=evidence_ids, condition_ids=condition_ids, relation=relation)
    ranking = Ranking.model_validate(
        {
            "results": [
                {"id": "C1", "original": original, "rewritten": {"relevant": False, "score": 0}}
            ]
        }
    )
    checked = checked_ranking(ranking, {"C1": 0})
    conditions = {"K1": Condition.model_validate(prerequisite())}
    with pytest.raises(AIUnavailable) as error:
        validate_support(checked, {"C1": 0}, CORPUS, conditions)
    assert error.value.code == "AI_SEARCH_INVALID"


@pytest.mark.parametrize("field", ["relation", "evidence_ids", "condition_ids"])
def test_missing_new_annotations_are_not_inferred_from_legacy_scores(field):
    view = original_assessment("C1")
    del view[field]
    with pytest.raises(ValidationError):
        OriginalAssessment.model_validate(view)


@pytest.mark.parametrize("reference", ["S1:E2", "S2:E1", "S1:E999"])
def test_answer_cannot_cite_unselected_or_invented_sentences(reference):
    span = evidence_spans("S1", CORPUS[0].text)[0]
    hit = Hit(CORPUS[0], 0.8, ((span.start, span.end),), "partial_support")

    class BadCitation:
        def generate(self, prompt, question):
            context = json.loads(prompt.split("DOCUMENT CONTEXT:\n", 1)[1])
            assert [s["evidence_id"] for s in context[0]["evidence"]] == ["S1:E1"]
            return json.dumps(
                {
                    "supported": True,
                    "answer": span.text,
                    "citations": [{"source_id": "S1", "evidence_ids": [reference]}],
                }
            )

    with pytest.raises(AIUnavailable) as error:
        answer_question("سؤال إجرائي", BadCitation(), [hit])
    assert error.value.code == "AI_ANSWER_INVALID"


@pytest.mark.parametrize("ranges", [(), ((0, 3),), ((0, 55), (0, 55))])
def test_invalid_retrieval_ranges_cannot_create_evidence(ranges):
    with pytest.raises(AIUnavailable) as error:
        answer_question("سؤال", object(), [Hit(CORPUS[0], 0.8, ranges, "partial_support")])
    assert error.value.code == "AI_ANSWER_INVALID"


def test_source_offsets_are_not_rewritten_or_moved_to_another_passage():
    sentence = evidence_spans("C1", CORPUS[0].text)[0]
    hit = Hit(
        replace(CORPUS[0], text="بادئة تغير مواضع الدليل. " + CORPUS[0].text),
        0.8,
        ((sentence.start, sentence.end),),
        "partial_support",
    )
    with pytest.raises(AIUnavailable):
        answer_question("سؤال", object(), [hit])


def test_protected_query_rewrite_contract_remains_unchanged():
    class LegacyRewrite:
        def generate(self, prompt, question):
            assert prompt.startswith("Rewrite")
            return '{"query":"طلب إجراء مستقل"}'

    assert rewrite_query("إيه", [], LegacyRewrite()) == "طلب إجراء مستقل"


def test_packaged_corpus_keeps_existing_cold_and_warm_call_counts():
    from app.services.retrieval import passages

    corpus = passages()
    provider = PolicyFixture({corpus[0].title: ("partial_support", [], True, 0.8)})
    search = HybridSearch()
    settings = Settings(_env_file=None)
    question = "كيف أبدأ؟"
    hits = search.search(question, [], provider, settings)
    assert answer_question(question, provider, hits).status == "answered"
    cold_calls = len(provider.prompts) + len(provider.batches)
    assert cold_calls == (len(corpus) + 7) // 8 + 4
    hits = search.search(question, [], provider, settings)
    assert answer_question(question, provider, hits).status == "answered"
    assert len(provider.prompts) + len(provider.batches) - cold_calls == 4
    assert settings.ai_call_budget == 20


def test_provider_generation_limits_and_model_are_unchanged(monkeypatch):
    from app.services.cloudflare import CloudflareProvider

    provider = CloudflareProvider(Settings(_env_file=None))
    captured = []
    monkeypatch.setattr(
        provider, "_invoke", lambda payload, model: captured.append((payload, model))
    )
    provider.generate("test-only instructions", "test-only question")
    payload, model = captured[0]
    assert payload["max_tokens"] == 600
    assert payload["temperature"] == 0.1
    assert payload["response_format"] == {"type": "json_object"}
    assert model == "@cf/meta/llama-3.1-8b-instruct-fp8-fast"
