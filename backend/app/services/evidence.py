"""Source-bound evidence spans. Quotes are sliced from retrieved text, not generated."""

from dataclasses import dataclass
import re


@dataclass(frozen=True)
class Evidence:
    id: str
    source_id: str
    start: int
    end: int
    text: str


def evidence_spans(source_id: str, text: str) -> tuple[Evidence, ...]:
    # Keep exact original offsets and punctuation. Sentence/newline boundaries
    # work for the current Arabic/English corpus; decimal dots do not split.
    matches = re.finditer(r"\S[^\n]*?(?:[.!?؟](?=\s|$)|(?=\n|$))", text)
    return tuple(
        Evidence(
            f"{source_id}:E{i}",
            source_id,
            match.start(),
            match.end(),
            text[match.start() : match.end()],
        )
        for i, match in enumerate(matches, 1)
    )


def exact_quote_ranges(spans: list[Evidence], text: str) -> list[tuple[str, str]]:
    """Merge only directly adjacent selected spans, never invent a joined quote.

    Nonadjacent evidence becomes separate source entries; each returned quote
    remains a literal contiguous substring of the original retrieved passage.
    """
    ordered = sorted(spans, key=lambda span: span.start)
    groups: list[list[Evidence]] = []
    for span in ordered:
        if groups and not text[groups[-1][-1].end : span.start].strip():
            groups[-1].append(span)
        else:
            groups.append([span])
    return [
        (
            group[0].id if len(group) == 1 else group[0].id + "-" + group[-1].id,
            text[group[0].start : group[-1].end],
        )
        for group in groups
    ]
