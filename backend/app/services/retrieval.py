"""Deterministic BM25 retrieval over explicitly fictional packaged documents."""

from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from importlib.resources import files
import math
import re
import unicodedata

STOP_WORDS = set(
    "كيف ما ماذا من هي هو هل الى إلى في عن على عند ان أن و او أو ثم هذا هذه الذي التي كم اريد أريد طلب طريقة كيفية can could how what who where when is are do does i the a an to for of and my please company policy شركة الشركة سياسة بال فين طريقة please tell me about many much days يوم أيام ايام عدد استطيع لي ابي ابغى".split()
)
# Query and corpus use the same small transparent bilingual vocabulary. This is
# lexical retrieval, not an embedding model or a claim of semantic search.
GROUPS = {
    "leave": "leave vacation holiday holidays اجازة اجازه الاجازة الاجازه إجازة إجازات اجازات الإجازات إجازتي",
    "annual": "annual annually سنوية سنويه السنوية سنوي السنة سنويا",
    "sick": "sick illness medical مرض مرضية المرضية مرضيه",
    "vpn": "vpn الافتراضية الافتراضي الخاصة الخاصه الافتراضيه",
    "it": "it التقني التقنية تقني تقنية الدعم support technical",
    "hr": "hr البشرية الموارد بشرية",
    "mfa": "mfa المصادقة العوامل الثنائيه الثنائية",
    "laptop": "laptop device equipment جهاز الجهاز أجهزة اجهزة حاسوب اللابتوب استلم استلام",
    "approval": "approval approvals approve موافقة الموافقة موافقه يوافق اعتماد",
    "hours": "hours working دوام الدوام ساعات العمل",
    "password": "password passwords المرور كلمة كلمات",
    "setup": "setup install configure connect connecting اتصل أتصل اوصل أوصل تثبيت إعداد اعداد اعدادات إعدادات خطوات",
    "request": "request submit أطلب اطلب طلب تقديم يقدم",
    "manager": "manager supervisor المدير مديري مدير",
    "balance": "balance رصيد رصيدي المتبقي",
    "salary": "salary salaries راتب راتبي الرواتب رواتب",
}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).lower()
    text = re.sub(r"[\u064b-\u065f\u0670\u0640]", "", text)
    return text.translate(str.maketrans("أإآىة", "ااايه"))


ALIASES = {normalize(word): key for key, words in GROUPS.items() for word in words.split()}
STOP = {normalize(word) for word in STOP_WORDS}


def tokens(text: str) -> list[str]:
    result = []
    for word in re.findall(r"[\w]+", normalize(text)):
        # Also recognize the common Arabic attached preposition/article forms.
        stem = word
        if stem not in ALIASES and stem.startswith("بال"):
            stem = stem[1:]
        if stem not in ALIASES and stem.startswith("ال"):
            stem = stem[2:]
        if word in STOP or stem in STOP or word.isdigit():
            continue
        result.append(ALIASES.get(stem, stem))
    return result


@dataclass(frozen=True)
class Passage:
    id: str
    document_id: str
    title: str
    section: str
    text: str
    page_number: int | None = None


@dataclass(frozen=True)
class Hit:
    passage: Passage
    score: float
    # None retains the existing lexical/protected behavior. Hybrid hits carry exact
    # original sentence offsets, never model-generated text or rewritten passages.
    support_ranges: tuple[tuple[int, int], ...] | None = None
    support_relation: str | None = None


@lru_cache
def passages() -> tuple[Passage, ...]:
    result = []
    directory = files("app").joinpath("demo_documents")
    for path in sorted(directory.iterdir(), key=lambda p: p.name):
        if not path.name.endswith(".md"):
            continue
        content = path.read_text(encoding="utf-8")
        title = content.splitlines()[0].removeprefix("# ").strip()
        document_id = path.name.removesuffix(".md")
        sections = re.split(r"^## ", content, flags=re.MULTILINE)[1:]
        for index, section in enumerate(sections, start=1):
            heading, text = section.split("\n", 1)
            result.append(
                Passage(f"{document_id}:{index}", document_id, title, heading.strip(), text.strip())
            )
    return tuple(result)


def retrieve(question: str, limit: int = 3) -> list[Hit]:
    query = set(tokens(question))
    if not query:
        return []
    corpus = passages()
    counts = [Counter(tokens(p.title + " " + p.section + " " + p.text)) for p in corpus]
    average_length = sum(sum(c.values()) for c in counts) / len(counts)
    hits = []
    for passage, frequencies in zip(corpus, counts):
        overlap = query.intersection(frequencies)
        # One generic overlapping word is not enough for a multi-topic question.
        required = 1 if len(query) <= 2 else 2
        if len(overlap) < required:
            continue
        score = 0.0
        length = sum(frequencies.values())
        for term in overlap:
            document_frequency = sum(term in c for c in counts)
            idf = math.log(
                1 + (len(corpus) - document_frequency + 0.5) / (document_frequency + 0.5)
            )
            tf = frequencies[term]
            score += idf * (tf * 2.5) / (tf + 1.5 * (0.25 + 0.75 * length / average_length))
        hits.append(Hit(passage, round(score, 6)))
    return sorted(hits, key=lambda h: (-h.score, h.passage.id))[:limit]
