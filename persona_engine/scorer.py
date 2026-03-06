from __future__ import annotations

from dataclasses import dataclass

from .config import EngineConfig
from .domain import PersonaSpec
from .utils import clamp, jaccard


@dataclass
class CandidateScore:
    value: float
    coverage: float
    length: float
    richness: float


_ALL_FIELDS = (
    "identity", "appearance", "background", "personality", "voice", "catchphrases",
    "goals", "relationships", "conflicts", "habits",
    "skills", "values", "taboos",
    "dialogue_examples", "opening_line", "system_constraints",
)
_REQUIRED_FIELDS = ("background", "personality", "voice")
_OPTIONAL_FIELDS = tuple(f for f in _ALL_FIELDS if f not in _REQUIRED_FIELDS)


def score_candidate(spec: PersonaSpec, config: EngineConfig) -> CandidateScore:
    # Coverage: required fields (bilingual) weighted 70%, optional fields (any lang) 30%
    required_ok = sum(1 for f in _REQUIRED_FIELDS if getattr(spec, f).zh or getattr(spec, f).en)
    optional_ok = sum(1 for f in _OPTIONAL_FIELDS if getattr(spec, f).zh or getattr(spec, f).en)
    coverage = clamp(required_ok / len(_REQUIRED_FIELDS) * 0.7 + optional_ok / len(_OPTIONAL_FIELDS) * 0.3)

    # Length: total zh chars across all 12 fields relative to long target
    total_zh = sum(len(getattr(spec, f).zh) for f in _ALL_FIELDS)
    length = clamp(total_zh / config.long_target_chars)

    # Richness: tag count relative to 2× cards-per-candidate (config-driven, no magic number)
    richness_target = max(1, config.inspiration_per_candidate * 2)
    richness = clamp(len(spec.tags) / richness_target)

    value = clamp(0.5 * coverage + 0.3 * length + 0.2 * richness)
    return CandidateScore(value=value, coverage=coverage, length=length, richness=richness)


def similarity(spec_a: PersonaSpec, spec_b: PersonaSpec) -> float:
    return jaccard(spec_a.tags, spec_b.tags)
