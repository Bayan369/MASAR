"""Demo chat: verified company evidence first, explicitly labeled Llama knowledge second."""

import re

from app.services.assistant import Answer, answer_question
from app.services.cloudflare import AIUnavailable
from app.services.general_answer import answer_general
from app.services.retrieval import normalize, retrieve

GREETING = r"(?:هاي|هلا(?: والله)?|اهلا(?: وسهلا)?|مرحبا|السلام عليكم(?: ورحمه الله(?: وبركاته)?)?|كيفك|hello|hi)"
AFFIRMATIVE = re.compile(r"(?:ايه|نعم|اكيد|تمام|كمل|بعدين|وش بعدها|الخطوه التاليه)[؟?!.,،\s]*$")


def clean_social_prefix(question):
    text = normalize(question).strip()
    match = re.match(GREETING + r"(?=$|[\s،,!؟?.])", text)
    return text[match.end() :].strip(" ،,!؟?.") if match else text


def answer_demo_question(question, provider, history, search=None, settings=None, trace=None):
    query = clean_social_prefix(question)
    if not query:
        return Answer(
            status="conversational", answer="أهلًا بك! كيف أقدر أساعدك في معلومات مسار؟", sources=[]
        )
    if AFFIRMATIVE.fullmatch(query):
        subject = next(
            (
                clean_social_prefix(turn["content"])
                for turn in reversed(history)
                if turn["role"] == "user"
                and clean_social_prefix(turn["content"])
                and not AFFIRMATIVE.fullmatch(clean_social_prefix(turn["content"]))
            ),
            None,
        )
        if not subject:
            return Answer(
                status="conversational", answer="أكيد، أي موضوع أو خطوة تقصد؟", sources=[]
            )
        query = subject
    hits = []
    general_needed = False
    try:
        hits = (
            search.search(
                question,
                history,
                provider,
                settings,
                **({"trace": trace} if trace is not None else {}),
            )
            if search is not None
            else retrieve(query)
        )
    except AIUnavailable as error:
        if error.code not in {"AI_SEARCH_INVALID", "AI_SEARCH_INCOMPLETE", "AI_EMBEDDING_INVALID"}:
            raise  # Transport, quota, budget and access failures never trigger another call.
        general_needed = True
    if not hits:
        general_needed = True
    if not general_needed:
        try:
            result = answer_question(question, provider, retrieved_hits=hits, conversation=history)
            general_needed = result.status == "not_found"
        except AIUnavailable as error:
            if error.code != "AI_ANSWER_INVALID":
                raise
            general_needed = True
    if general_needed:
        # A NEW generation task, not repair/relabeling of rejected company output.
        # Its explicit status/disclaimer and empty sources prevent company attribution.
        result = answer_general(question, provider, history)
    if trace is not None:
        by_source = {f"S{i}": hit.passage.id for i, hit in enumerate(hits, 1)}
        trace(
            {
                "stage": "answer_sources",
                "status": result.status,
                "passages": list(
                    dict.fromkeys(
                        by_source[source.id.split(":", 1)[0]] for source in result.sources
                    )
                ),
            }
        )
    return result
