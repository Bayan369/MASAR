"""Opt-in real Cloudflare acceptance checks. No fixtures, fake vectors or token output."""

import argparse
import json
import sys

from app.config import Settings
from app.services.cloudflare import AIUnavailable, CloudflareProvider
from app.services.demo_conversation import answer_demo_question
from app.services.retrieval import passages
from app.services.semantic_search import HybridSearch, PROTOCOL
from scripts.start_server import configure_logging

ONBOARDING_QUESTIONS = (
    "وش أسوي بأول يوم؟",
    "أنا موظف جديد، كيف أبدأ؟",
    "وش المطلوب مني بعد المباشرة؟",
    "What should I do on my first day?",
    "كيف أبدأ دوامي الجديد؟",
)


def print_evidence_diagnostics(case_index, document, section, result, trace):
    """Metadata only. Never print questions, rewritten text, answers, quotes or prompts."""
    matches = any(
        source.document_id == document and (section is None or section in source.section)
        for source in result.sources
    )
    if matches:
        return
    expected = [
        p.id
        for p in passages()
        if p.document_id == document and (section is None or section in p.section)
    ]
    print(
        "case_evidence_mismatch "
        + json.dumps({"case_index": case_index, "expected_passages": expected}, ensure_ascii=True)
    )
    for event in trace:
        print("case_trace " + json.dumps({"case_index": case_index, **event}, ensure_ascii=True))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--run-live", action="store_true", help="Allow real Workers Free model calls"
    )
    parser.add_argument(
        "--extended",
        action="store_true",
        help="Also test ambiguous onboarding and short confirmations with real history",
    )
    parser.add_argument(
        "--onboarding-case",
        type=int,
        choices=range(1, len(ONBOARDING_QUESTIONS) + 1),
        help="Run one unchanged onboarding acceptance case, with safe stage metadata on failure",
    )
    args = parser.parse_args()
    if args.extended and args.onboarding_case is not None:
        parser.error("Choose either the full extended suite or one onboarding case")
    if not args.run_live:
        print("No model calls made. Explicit --run-live is required.")
        return 2
    try:
        settings = Settings()
    except Exception:
        print("Backend settings validation failed; no values printed, no model calls made.")
        return 2
    missing = []
    if not settings.cloudflare_account_id:
        missing.append("MASAR_CLOUDFLARE_ACCOUNT_ID")
    if not settings.cloudflare_api_token.get_secret_value():
        missing.append("MASAR_CLOUDFLARE_API_TOKEN")
    if not settings.cloudflare_free_plan_confirmed:
        missing.append("MASAR_CLOUDFLARE_FREE_PLAN_CONFIRMED")
    if settings.retrieval_mode != "hybrid":
        missing.append("MASAR_RETRIEVAL_MODE (hybrid required)")
    # Extended evaluation uses up to roughly 53 calls; never raise the budget silently.
    required_budget = (
        ((len(passages()) + 7) // 8 + 4)
        if args.onboarding_case is not None
        else (60 if args.extended else 40)
    )
    if settings.ai_call_budget < required_budget:
        missing.append(f"MASAR_AI_CALL_BUDGET (at least {required_budget} for this evaluation)")
    if missing:
        print("Missing/unsuitable settings: " + ", ".join(missing))
        print("No Cloudflare request made.")
        return 2
    configure_logging()
    provider, search = CloudflareProvider(settings), HybridSearch()

    case_index = 0

    def ask(question, history, document=None, section=None):
        nonlocal case_index
        case_index += 1
        print(
            "case_start "
            + json.dumps(
                {
                    "case_index": case_index,
                    "protocol": PROTOCOL,
                    "expected_document": document,
                    "expected_section": section,
                },
                ensure_ascii=True,
            )
        )
        trace = []
        result = answer_demo_question(
            question, provider, history, search, settings, trace=trace.append
        )
        if document is not None:
            assert result.status == "answered" and result.sources, "Expected a grounded answer"
            assert result.generated_by == "Cloudflare Workers AI / Llama", (
                "Missing model provenance"
            )
            print_evidence_diagnostics(case_index, document, section, result, trace)
            assert any(
                source.document_id == document and (section is None or section in source.section)
                for source in result.sources
            ), "Expected evidence not selected"
            assert all(
                any(
                    source.quote in p.text and source.document_id == p.document_id
                    for p in passages()
                )
                for source in result.sources
            ), "Quote not in original corpus"
        print(
            "status="
            + result.status
            + " documents="
            + ",".join(sorted({s.document_id for s in result.sources}))
        )
        return result

    try:
        if args.onboarding_case is not None:
            case_index = args.onboarding_case - 1
            ask(
                ONBOARDING_QUESTIONS[args.onboarding_case - 1],
                [],
                "employee-handbook",
                "Onboarding",
            )
            print("Targeted onboarding case passed; full acceptance suite was not run.")
            return 0
        for question in ONBOARDING_QUESTIONS:
            onboarding = ask(question, [], "employee-handbook", "Onboarding")
        if args.extended:
            ask(
                "كيف أبدأ دوامي؟",
                [
                    {"role": "user", "content": ONBOARDING_QUESTIONS[-1]},
                    {"role": "assistant", "content": onboarding.answer[:2000]},
                ],
                "employee-handbook",
                "Onboarding",
            )
        question = "ما هي سياسة الإجازات؟"
        result = ask(question, [], "leave-policy")
        ask(
            "كيف أقدم طلبها؟",
            [
                {"role": "user", "content": question},
                {"role": "assistant", "content": result.answer[:2000]},
            ],
            "leave-policy",
        )
        if args.extended:
            offer = "اشرح سياسة الإجازات المتاحة ثم اسألني هل أريد معرفة إجراء تقديم الطلب"
            actual_offer = ask(offer, [], "leave-policy")
            history = [
                {"role": "user", "content": offer},
                {"role": "assistant", "content": actual_offer.answer[:2000]},
            ]
            for confirmation in ("نعم", "إيه", "أكيد"):
                ask(confirmation, history, "leave-policy")
        general = ask("ما رقم الرحلة القادمة إلى المريخ؟", [])
        assert general.status == "general" and not general.sources
        assert general.generated_by == "Cloudflare Workers AI / Llama"
        for greeting in ("هاي", "هلا", "أهلًا", "مرحبا", "السلام عليكم", "كيفك", "كيفك؟"):
            assert ask(greeting, []).status == "conversational"
    except AIUnavailable as error:
        print("Live evaluation stopped; code=" + error.code)
        return 1
    except AssertionError as error:
        print("Live acceptance failed: " + str(error))
        return 1
    print("Real Cloudflare semantic/RAG acceptance passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
