from __future__ import annotations

from copy import deepcopy

from .config import EngineConfig
from .domain import PersonaSpec
from .utils import truncate_sentence


REQUIRED_FIELDS = ("background", "personality", "voice")


def compress_spec(spec: PersonaSpec, config: EngineConfig) -> PersonaSpec:
    short_spec = deepcopy(spec)
    required_budget = max(80, config.short_target_chars // 3)
    optional_budget = max(60, config.short_target_chars // 6)

    for field_name, value in short_spec.__dict__.items():
        if not hasattr(value, "zh"):
            continue
        budget = required_budget if field_name in REQUIRED_FIELDS else optional_budget
        value.zh = truncate_sentence(value.zh, budget)
        value.en = truncate_sentence(value.en, budget)
    return short_spec
