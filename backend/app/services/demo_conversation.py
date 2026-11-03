"""Social intent and bounded conversation context; factual answers always use RAG/Llama."""

import re

from app.services.assistant import Answer, answer_question
from app.services.retrieval import normalize, retrieve

GREETING = r"(?:هاي|هلا(?: والله)?|اهلا(?: وسهلا)?|مرحبا|السلام عليكم(?: ورحمه الله(?: وبركاته)?)?|كيفك|hello|hi)"
AFFIRMATIVE = re.compile(r"(?:ايه|نعم|اكيد|تمام|كمل|بعدين|وش بعدها|الخطوه التاليه)[؟?!.,،\s]*$")


def clean_social_prefix(question):
    text = normalize(question).strip()
    match = re.match(GREETING + r"(?=$|[\s،,!؟?.])", text)
    return text[match.end() :].strip(" ،,!؟?.") if match else text


def answer_demo_question(question, provider, history, search=None, settings=None):
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
    hits = (
        search.search(question, history, provider, settings)
        if search is not None
        else retrieve(query)
    )
    return answer_question(question, provider, retrieved_hits=hits, conversation=history)
