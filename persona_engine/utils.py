from __future__ import annotations

import random
import re
from typing import Iterable


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def dedupe_preserve(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        output.append(item)
    return output


def safe_format(template: str, values: dict[str, str]) -> str:
    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        return values.get(key, match.group(0))

    return re.sub(r"\{([a-zA-Z0-9_]+)\}", replace, template)


def strip_unresolved(text: str) -> str:
    """Remove any {placeholder} tokens left unresolved after safe_format."""
    return re.sub(r"\{[a-zA-Z0-9_]+\}", "", text).strip()


def truncate_sentence(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars].rsplit("。", 1)[0].rsplit(".", 1)[0]
    if len(cut) < max_chars * 0.6:
        cut = text[:max_chars].rsplit("，", 1)[0].rsplit(",", 1)[0]
    if not cut:
        cut = text[:max_chars]
    return cut.rstrip() + "…"


def jaccard(a: Iterable[str], b: Iterable[str]) -> float:
    set_a = set(a)
    set_b = set(b)
    if not set_a and not set_b:
        return 0.0
    return len(set_a & set_b) / len(set_a | set_b)


def rng(seed: int | None) -> random.Random:
    return random.Random(seed)


# CJK Unified Ideographs block: U+4E00–U+9FFF (covers common Chinese characters)
_CJK_RE = re.compile(r"[\u4e00-\u9fff]")


def is_cjk(text: str) -> bool:
    """Return True if *text* contains at least one CJK (Chinese/Japanese/Korean) character."""
    return bool(_CJK_RE.search(text))
