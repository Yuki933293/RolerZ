from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class LocalizedText:
    zh: str = ""
    en: str = ""

    def as_dict(self, language: str | None = None) -> dict[str, str] | str:
        if language:
            return getattr(self, language, "")
        return {"zh": self.zh, "en": self.en}


@dataclass
class PersonaSpec:
    identity: LocalizedText = field(default_factory=LocalizedText)
    appearance: LocalizedText = field(default_factory=LocalizedText)
    background: LocalizedText = field(default_factory=LocalizedText)
    personality: LocalizedText = field(default_factory=LocalizedText)
    voice: LocalizedText = field(default_factory=LocalizedText)
    catchphrases: LocalizedText = field(default_factory=LocalizedText)
    goals: LocalizedText = field(default_factory=LocalizedText)
    relationships: LocalizedText = field(default_factory=LocalizedText)
    conflicts: LocalizedText = field(default_factory=LocalizedText)
    habits: LocalizedText = field(default_factory=LocalizedText)
    skills: LocalizedText = field(default_factory=LocalizedText)
    values: LocalizedText = field(default_factory=LocalizedText)
    taboos: LocalizedText = field(default_factory=LocalizedText)
    dialogue_examples: LocalizedText = field(default_factory=LocalizedText)
    opening_line: LocalizedText = field(default_factory=LocalizedText)
    system_constraints: LocalizedText = field(default_factory=LocalizedText)
    usage_notes: LocalizedText = field(default_factory=LocalizedText)
    tags: list[str] = field(default_factory=list)

    def as_dict(self, language: str | None = None) -> dict[str, Any]:
        return {
            "identity": self.identity.as_dict(language),
            "appearance": self.appearance.as_dict(language),
            "background": self.background.as_dict(language),
            "personality": self.personality.as_dict(language),
            "voice": self.voice.as_dict(language),
            "catchphrases": self.catchphrases.as_dict(language),
            "goals": self.goals.as_dict(language),
            "relationships": self.relationships.as_dict(language),
            "conflicts": self.conflicts.as_dict(language),
            "habits": self.habits.as_dict(language),
            "skills": self.skills.as_dict(language),
            "values": self.values.as_dict(language),
            "taboos": self.taboos.as_dict(language),
            "dialogue_examples": self.dialogue_examples.as_dict(language),
            "opening_line": self.opening_line.as_dict(language),
            "system_constraints": self.system_constraints.as_dict(language),
            "usage_notes": self.usage_notes.as_dict(language),
            "tags": list(self.tags),
        }


@dataclass
class PersonaSeed:
    concept: str
    target_use: str = ""
    background_hint: str = ""
    personality_hint: str = ""
    voice_hint: str = ""
    constraints: list[str] = field(default_factory=list)
    preferences: list[str] = field(default_factory=list)
    selected_inspirations: list[str] = field(default_factory=list)
    answers: dict[str, str] = field(default_factory=dict)


@dataclass
class Question:
    id: str
    field: str
    zh: str
    en: str

    def as_dict(self, language: str | None = None) -> dict[str, str]:
        d: dict[str, str] = {"id": self.id, "field": self.field}
        if language:
            d["text"] = getattr(self, language, self.zh)
        else:
            d["zh"] = self.zh
            d["en"] = self.en
        return d


@dataclass
class PersonaCandidate:
    id: str
    spec_long: PersonaSpec
    spec_short: PersonaSpec
    natural_long: dict[str, str]
    natural_short: dict[str, str]
    score: float
    tags: list[str]
    sources: list[str]

    def as_dict(self, language: str | None = None) -> dict[str, Any]:
        result: dict[str, Any] = {
            "id": self.id,
            "score": self.score,
            "tags": list(self.tags),
            "sources": list(self.sources),
            "spec_long": self.spec_long.as_dict(language),
            "spec_short": self.spec_short.as_dict(language),
        }
        if language:
            result["natural_long"] = self.natural_long.get(language, "")
            result["natural_short"] = self.natural_short.get(language, "")
        else:
            result["natural_long"] = dict(self.natural_long)
            result["natural_short"] = dict(self.natural_short)
        return result


@dataclass
class PersonaOutput:
    candidates: list[PersonaCandidate]
    questions: list[Question] = field(default_factory=list)
    meta: dict[str, Any] = field(default_factory=dict)

    def as_dict(self, language: str | None = None) -> dict[str, Any]:
        return {
            "candidates": [c.as_dict(language) for c in self.candidates],
            "questions": [q.as_dict(language) for q in self.questions],
            "meta": dict(self.meta),
        }
