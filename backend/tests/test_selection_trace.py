"""Observed-signature counterexample, NOT a replay or proof of the user's model output."""

import json
import sys

from app.config import Settings
from app.services.retrieval import passages
from app.services.semantic_search import HybridSearch
from scripts import evaluate_semantic
from test_semantic_search import SearchFixture, vector


class FinalChoiceFixture(SearchFixture):
    settings = Settings(_env_file=None)

    def embed(self, texts):
        self.batches.append(texts)
        return [
            vector(0 if "Onboarding" in text or "Working hours" in text or len(text) < 100 else 1)
            for text in texts
        ]

    def generate(self, prompt, question):
        if prompt.startswith("Rewrite"):
            return super().generate(prompt, question)
        if prompt.startswith("Rerank"):
            metadata = json.loads(prompt.split("CANDIDATES JSON:\n", 1)[1])
            return json.dumps(
                {
                    "results": [
                        {
                            "id": p["id"],
                            "relevant": "Onboarding" in p["section"]
                            or "Working hours" in p["section"],
                            "score": 0.95
                            if "Onboarding" in p["section"]
                            else (0.9 if "Working hours" in p["section"] else 0.1),
                        }
                        for p in metadata["passages"]
                    ]
                }
            )
        context = json.loads(prompt.split("DOCUMENT CONTEXT:\n", 1)[1])
        # Deliberately choose an adjacent but different section only in the English fixture.
        source = context[1] if question == evaluate_semantic.ONBOARDING_QUESTIONS[3] else context[0]
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


def test_fourth_case_reports_where_expected_passage_was_lost_without_weakening_acceptance(
    monkeypatch, capsys
):
    settings = Settings(
        _env_file=None,
        cloudflare_account_id="a" * 32,
        cloudflare_api_token="test-only",
        cloudflare_free_plan_confirmed=True,
        ai_call_budget=60,
    )
    monkeypatch.setattr(evaluate_semantic, "Settings", lambda: settings)
    monkeypatch.setattr(evaluate_semantic, "CloudflareProvider", lambda _: FinalChoiceFixture())
    monkeypatch.setattr(evaluate_semantic, "configure_logging", lambda: None)
    monkeypatch.setattr(sys, "argv", ["evaluate_semantic", "--run-live"])
    assert evaluate_semantic.main() == 1
    output = capsys.readouterr().out
    assert output.count("status=answered documents=employee-handbook") == 3
    mismatch = json.loads(
        next(
            line.removeprefix("case_evidence_mismatch ")
            for line in output.splitlines()
            if line.startswith("case_evidence_mismatch ")
        )
    )
    assert mismatch == {"case_index": 4, "expected_passages": ["employee-handbook:1"]}
    events = [
        json.loads(line.removeprefix("case_trace "))
        for line in output.splitlines()
        if line.startswith("case_trace ")
    ]
    candidates = next(e for e in events if e["stage"] == "answer_candidates")
    selected = next(e for e in events if e["stage"] == "answer_sources")
    assert "employee-handbook:1" in candidates["passages"]
    assert selected["passages"] == ["employee-handbook:2"]
    assert "Live acceptance failed: Expected evidence not selected" in output
    assert "test-only" not in output and "a" * 32 not in output
    assert not any(p.text in output for p in passages())


def test_trace_does_not_change_search_or_make_additional_model_calls():
    first, second = SearchFixture(), SearchFixture()
    settings = Settings(_env_file=None)
    plain = HybridSearch().search("سؤال عن البداية", [], first, settings)
    events = []
    traced = HybridSearch().search("سؤال عن البداية", [], second, settings, trace=events.append)
    assert plain == traced
    assert len(first.batches) == len(second.batches)
    assert len(first.prompts) == len(second.prompts)
    assert [e["stage"] for e in events] == [
        "rewrite",
        "vector",
        "keyword",
        "rrf",
        "rerank",
        "answer_candidates",
    ]
    assert "employee onboarding equipment" not in json.dumps(events)


def test_targeted_fourth_case_preserves_same_evidence_assertion_at_existing_budget(
    monkeypatch, capsys
):
    settings = Settings(
        _env_file=None,
        cloudflare_account_id="a" * 32,
        cloudflare_api_token="test-only",
        cloudflare_free_plan_confirmed=True,
    )
    assert settings.ai_call_budget == 20
    fixture = FinalChoiceFixture()
    monkeypatch.setattr(evaluate_semantic, "Settings", lambda: settings)
    monkeypatch.setattr(evaluate_semantic, "CloudflareProvider", lambda _: fixture)
    monkeypatch.setattr(evaluate_semantic, "configure_logging", lambda: None)
    monkeypatch.setattr(sys, "argv", ["evaluate_semantic", "--run-live", "--onboarding-case", "4"])
    assert evaluate_semantic.main() == 1
    output = capsys.readouterr().out
    assert output.count("case_start ") == 1
    assert '"case_index": 4' in output
    assert "Expected evidence not selected" in output
    assert "full acceptance suite" not in output
    assert settings.ai_call_budget == 20
