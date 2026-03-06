"""
Safety utilities for the Persona Wizard Core Engine.

Two independent checks:

1. ``detect_constraint_conflicts(constraints)``
   Scans a seed's constraint list for mutually contradictory traits
   (e.g. ["温柔", "冷酷"]). Returns a list of ConstraintConflict objects.
   Called once per seed, before generation.

2. ``scan_spec(spec)``
   Scans all text fields of a generated PersonaSpec for known stereotype
   or high-risk patterns. Returns a list of SafetyFlag objects.
   Called once per candidate, after generation, before scoring.

Both checks are purely rule-based and require no external dependencies.
The rule tables are intentionally small and clearly labelled so project
owners can extend them without touching engine logic.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

from .domain import PersonaSpec


# ---------------------------------------------------------------------------
# Part 1 — Constraint conflict detection
# ---------------------------------------------------------------------------

@dataclass
class ConstraintConflict:
    a: str          # first conflicting constraint (as provided by caller)
    b: str          # second conflicting constraint
    reason: str     # human-readable explanation (zh)
    reason_en: str  # human-readable explanation (en)


# Each rule: (set of zh tokens, set of en tokens, reason_zh, reason_en)
# A conflict fires when ≥1 zh token AND ≥1 zh token from the same pair are
# both present, OR ≥1 en token from each side.
_CONFLICT_RULES: list[tuple[frozenset[str], frozenset[str], str, str]] = [
    (
        frozenset(["温柔", "柔和", "温情"]),
        frozenset(["冷酷", "残忍", "冷漠"]),
        "性格矛盾：温柔与冷酷难以共存",
        "personality conflict: gentle vs cruel",
    ),
    (
        frozenset(["内向", "沉默", "孤僻"]),
        frozenset(["外向", "话多", "健谈", "社交达人"]),
        "社交倾向矛盾：内向与外向难以共存",
        "social orientation conflict: introverted vs extroverted",
    ),
    (
        frozenset(["理性", "冷静", "逻辑"]),
        frozenset(["冲动", "感性", "情绪化"]),
        "决策风格矛盾：极端理性与极端冲动难以共存",
        "decision style conflict: rational vs impulsive",
    ),
    (
        frozenset(["诚实", "正直", "守信"]),
        frozenset(["欺骗", "说谎", "伪装"]),
        "价值观矛盾：诚实与欺骗难以共存",
        "values conflict: honest vs deceptive",
    ),
    (
        frozenset(["善良", "仁慈", "慈悲"]),
        frozenset(["邪恶", "恶毒", "残暴"]),
        "道德取向矛盾：善良与邪恶难以共存",
        "moral conflict: benevolent vs malevolent",
    ),
]


def detect_constraint_conflicts(constraints: list[str]) -> list[ConstraintConflict]:
    """
    Return a list of conflicting constraint pairs found in ``constraints``.

    The check is case-insensitive and whitespace-tolerant.
    An empty list means no conflicts were detected.
    """
    if len(constraints) < 2:
        return []

    normalised = {c: c.lower().strip() for c in constraints}
    norm_set = set(normalised.values())
    conflicts: list[ConstraintConflict] = []

    for side_a, side_b, reason_zh, reason_en in _CONFLICT_RULES:
        matched_a = [c for c, n in normalised.items() if n in side_a]
        matched_b = [c for c, n in normalised.items() if n in side_b]
        if matched_a and matched_b:
            conflicts.append(ConstraintConflict(
                a=matched_a[0],
                b=matched_b[0],
                reason=reason_zh,
                reason_en=reason_en,
            ))

    return conflicts


# ---------------------------------------------------------------------------
# Part 2 — Spec safety / anti-stereotype scanning
# ---------------------------------------------------------------------------

@dataclass
class SafetyFlag:
    field: str                              # spec field name (e.g. "background")
    lang: str                               # "zh" or "en"
    matched: str                            # the matched text snippet
    category: str                           # e.g. "gender_stereotype"
    severity: Literal["low", "medium", "high"]


# Each rule: (compiled pattern, category label, severity)
# Patterns intentionally use non-greedy matching to minimise false positives.
_SAFETY_RULES: list[tuple[re.Pattern, str, Literal["low", "medium", "high"]]] = [
    # Gender stereotypes
    (re.compile(r"女性.{0,6}(应该|必须|只能|天生)", re.IGNORECASE),
     "gender_stereotype", "medium"),
    (re.compile(r"男性.{0,6}(应该|必须|只能|天生)", re.IGNORECASE),
     "gender_stereotype", "medium"),
    (re.compile(r"women?.{0,10}(should|must|only|naturally)\b", re.IGNORECASE),
     "gender_stereotype", "medium"),
    (re.compile(r"men?.{0,10}(should|must|only|naturally)\b", re.IGNORECASE),
     "gender_stereotype", "medium"),
    # Racial/ethnic stereotypes (broad signal)
    (re.compile(r"(所有|全部|每个).{0,4}(黑人|白人|亚裔|种族).{0,6}(都|必然|天生)", re.IGNORECASE),
     "racial_stereotype", "high"),
    (re.compile(r"all\s+(black|white|asian|hispanic).{0,20}(are|always|naturally)\b",
                re.IGNORECASE),
     "racial_stereotype", "high"),
    # Explicit violence incitement
    (re.compile(r"(鼓励|教唆|煽动).{0,8}(杀人|暴力|伤害他人)", re.IGNORECASE),
     "violence_incitement", "high"),
    (re.compile(r"(encourage|incite|promote)\s+.{0,10}(violence|murder|harm\s+others)",
                re.IGNORECASE),
     "violence_incitement", "high"),
    # Self-harm glorification
    (re.compile(r"(美化|鼓励|宣扬).{0,8}(自杀|自残|轻生)", re.IGNORECASE),
     "self_harm_glorification", "high"),
    (re.compile(r"(glorif|promot|celebrat).{0,10}(suicide|self.harm)\b", re.IGNORECASE),
     "self_harm_glorification", "high"),
]

_SPEC_TEXT_FIELDS = (
    "identity", "background", "personality", "voice",
    "goals", "relationships", "conflicts", "habits",
    "skills", "values", "taboos", "usage_notes",
)


def scan_spec(spec: PersonaSpec) -> list[SafetyFlag]:
    """
    Scan all text fields of a PersonaSpec for known problematic patterns.

    Returns a list of SafetyFlag objects (empty if no issues found).
    Severity levels:
    - ``"low"``    — worth noting, minor adjustment recommended
    - ``"medium"`` — review before deployment
    - ``"high"``   — replace or heavily edit the flagged content
    """
    flags: list[SafetyFlag] = []

    for field_name in _SPEC_TEXT_FIELDS:
        lt = getattr(spec, field_name, None)
        if lt is None:
            continue
        for lang, text in (("zh", lt.zh), ("en", lt.en)):
            if not text:
                continue
            for pattern, category, severity in _SAFETY_RULES:
                m = pattern.search(text)
                if m:
                    flags.append(SafetyFlag(
                        field=field_name,
                        lang=lang,
                        matched=m.group(0),
                        category=category,
                        severity=severity,
                    ))

    return flags


# ---------------------------------------------------------------------------
# Score penalty helper
# ---------------------------------------------------------------------------

_SEVERITY_PENALTY: dict[str, float] = {
    "low": 0.05,
    "medium": 0.15,
    "high": 0.35,
}


def safety_score_penalty(flags: list[SafetyFlag]) -> float:
    """
    Return a total score penalty in [0, 1] based on the detected flags.

    Penalties are additive but capped at 1.0 so a candidate score never
    goes below 0 after subtraction.
    """
    total = sum(_SEVERITY_PENALTY.get(f.severity, 0.0) for f in flags)
    return min(total, 1.0)
