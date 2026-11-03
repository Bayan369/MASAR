"""Opt-in real Cloudflare acceptance checks. No fixtures, fake vectors or token output."""

import argparse
import sys

from app.config import Settings
from app.services.cloudflare import AIUnavailable, CloudflareProvider
from app.services.demo_conversation import answer_demo_question
from app.services.retrieval import passages
from app.services.semantic_search import HybridSearch

ONBOARDING_QUESTIONS = (
    "وش أسوي بأول يوم؟",
    "أنا موظف جديد، كيف أبدأ؟",
    "وش المطلوب مني بعد المباشرة؟",
    "What should I do on my first day?",
    "كيف أبدأ دوامي الجديد؟",
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--run-live", action="store_true", help="Allow real Workers Free model calls"
    )
    args = parser.parse_args()
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
    # Five onboarding + leave + continuation + out-of-corpus use up to 33 calls.
    if settings.ai_call_budget < 40:
        missing.append("MASAR_AI_CALL_BUDGET (at least 40 for the complete evaluation)")
    if missing:
        print("Missing/unsuitable settings: " + ", ".join(missing))
        print("No Cloudflare request made.")
        return 2
    provider, search = CloudflareProvider(settings), HybridSearch()

    def ask(question, history, document=None, section=None):
        result = answer_demo_question(question, provider, history, search, settings)
        if document is not None:
            assert result.status == "answered" and result.sources, "Expected a grounded answer"
            assert result.generated_by == "Cloudflare Workers AI / Llama", (
                "Missing model provenance"
            )
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
        for question in ONBOARDING_QUESTIONS:
            ask(question, [], "employee-handbook", "Onboarding")
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
        assert ask("ما رقم الرحلة القادمة إلى المريخ؟", []).status == "not_found"
        for greeting in ("هاي", "هلا", "أهلًا", "مرحبا", "السلام عليكم", "كيفك"):
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
