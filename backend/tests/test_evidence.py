"""Offline protocol fixtures only; no canned production responses or live AI claims."""

import json
import re

import pytest

from app.services.assistant import answer_question
from app.services.cloudflare import AIUnavailable
from app.services.evidence import evidence_spans, exact_quote_ranges
from app.services.retrieval import passages, retrieve
from test_assistant import settings


class EvidenceSelectingModel:
    settings = settings()

    def __init__(self, evidence_language="en", answer_language="ar", corrupt=None):
        self.evidence_language = evidence_language
        self.answer_language = answer_language
        self.corrupt = corrupt

    def generate(self, system, question):
        assert "Arabic by default even for an English question" in system
        assert "explicitly requests an English answer" in system
        assert "Do NOT generate, copy, translate or paraphrase a quote field" in system
        context = json.loads(system.split("DOCUMENT CONTEXT:\n")[1])
        source = next(s for s in context if "VPN setup steps" in s["section"])
        selected = [
            e
            for e in source["evidence"]
            if bool(re.search(r"[\u0600-\u06ff]", e["text"])) == (self.evidence_language == "ar")
        ][:2]
        assert len(selected) == 2
        citation = {
            "source_id": source["source_id"],
            "evidence_ids": [e["evidence_id"] for e in selected],
        }
        answer = (
            "Use the company-managed device, IT-approved VPN application and complete MFA."
            if self.answer_language == "en"
            else "استخدم جهاز العمل وتطبيق VPN المعتمد من IT وأكمل المصادقة متعددة العوامل (MFA)."
        )
        if self.corrupt == "invented_id":
            citation["evidence_ids"] = ["S1:E9999"]
        if self.corrupt == "wrong_source":
            other = next(s for s in context if s["source_id"] != source["source_id"])
            citation["evidence_ids"] = [other["evidence"][0]["evidence_id"]]
        if self.corrupt == "invented_quote":
            citation["quote"] = "A nonexistent VPN address is vpn.fake.invalid."
        if self.corrupt == "translated_quote":
            citation["quote"] = "ثبّت البرنامج ثم سجل دخولك."
        if self.corrupt == "legacy_quote_only":
            citation = {
                "source_id": source["source_id"],
                "quote": "A fabricated quotation not in the source.",
            }
        if self.corrupt == "duplicate_id":
            citation["evidence_ids"] = [selected[0]["evidence_id"]] * 2
        if self.corrupt == "no_evidence":
            citation["evidence_ids"] = []
        citations = [citation, citation] if self.corrupt == "duplicate_source" else [citation]
        return json.dumps(
            {"supported": True, "answer": answer, "citations": citations}, ensure_ascii=False
        )


@pytest.mark.parametrize(
    "question,answer_language",
    [
        ("How do I connect to the company VPN?", "ar"),
        ("كيف أتصل بشبكة VPN الخاصة بالشركة؟", "ar"),
        ("Answer in English: How do I connect to the company VPN?", "en"),
        ("أجب بالإنجليزية: كيف أتصل بشبكة VPN الخاصة بالشركة؟", "en"),
    ],
)
@pytest.mark.parametrize("evidence_language", ["ar", "en"])
def test_bilingual_questions_answers_keep_original_evidence(
    question, answer_language, evidence_language
):
    result = answer_question(question, EvidenceSelectingModel(evidence_language, answer_language))
    assert result.status == "answered"
    assert result.answer.startswith("Use" if answer_language == "en" else "استخدم")
    assert result.sources
    for source in result.sources:
        assert source.document_id == "vpn-setup-guide" and "VPN setup steps" in source.section
        assert source.quote in source.excerpt
        assert bool(re.search(r"[\u0600-\u06ff]", source.quote)) == (evidence_language == "ar")
        assert any(source.quote in h.passage.text for h in retrieve(question))


@pytest.mark.parametrize(
    "corrupt",
    [
        "invented_id",
        "wrong_source",
        "invented_quote",
        "translated_quote",
        "legacy_quote_only",
        "duplicate_id",
        "no_evidence",
        "duplicate_source",
    ],
)
def test_invented_translated_misattributed_citations_rejected(corrupt, caplog):
    with pytest.raises(AIUnavailable) as error:
        answer_question(
            "How do I connect to the company VPN?", EvidenceSelectingModel(corrupt=corrupt)
        )
    assert error.value.code == "AI_ANSWER_INVALID" and error.value.status == 502
    assert "llama_answer_rejected" in caplog.text
    assert "vpn.fake.invalid" not in caplog.text and "ثبّت البرنامج" not in caplog.text


def test_evidence_offsets_cover_all_current_bilingual_passages():
    for passage in passages():
        spans = evidence_spans("S1", passage.text)
        assert spans and len({span.id for span in spans}) == len(spans)
        assert re.sub(r"\s", "", "".join(s.text for s in spans)) == re.sub(r"\s", "", passage.text)
        assert all(s.text == passage.text[s.start : s.end] for s in spans)


def test_nonadjacent_evidence_not_spliced_into_fake_quote():
    text = "First sentence. Second sentence. Third sentence."
    spans = evidence_spans("S1", text)
    ranges = exact_quote_ranges([spans[2], spans[0]], text)
    assert len(ranges) == 2
    assert [quote for _, quote in ranges] == ["First sentence.", "Third sentence."]
    assert all(quote in text for _, quote in ranges)


def test_adjacent_evidence_preserves_whitespace_and_punctuation():
    text = "أول جملة.  ثاني جملة.\nEnglish sentence."
    spans = evidence_spans("S2", text)
    ranges = exact_quote_ranges([spans[1], spans[0]], text)
    assert len(ranges) == 1 and ranges[0][1] == "أول جملة.  ثاني جملة."


def test_decimal_numbers_do_not_break_spans():
    spans = evidence_spans("S1", "A value of 1.5 is stated. Another sentence.")
    assert len(spans) == 2 and spans[0].text == "A value of 1.5 is stated."


@pytest.mark.parametrize(
    "question", ["How do I connect to the company VPN?", "كيف أتصل بشبكة VPN الخاصة بالشركة؟"]
)
def test_vpn_setup_ranked_first(question):
    assert retrieve(question)[0].passage.id == "vpn-setup-guide:2"
