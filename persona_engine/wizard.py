"""
Interactive multi-turn persona wizard.

Usage:
    engine = WizardEngine()
    questions = engine.start("一个沉默的城市治愈者")
    for q in questions:
        print(q.zh)
    questions = engine.answer("background", "曾是战地医护，退役后隐居城中")
    # ... repeat until questions is empty
    output = engine.finish()
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from .config import EngineConfig
from .domain import PersonaOutput, PersonaSeed, Question
from .pipeline import PersonaEngine, QUESTION_MAP


# Fields asked in order of importance
WIZARD_FIELD_ORDER = [
    "appearance",
    "background",
    "personality",
    "voice",
    "goals",
    "conflicts",
]

OPTIONAL_FIELDS = ("goals", "conflicts")
REQUIRED_FIELDS = {"appearance", "background", "personality", "voice"}


@dataclass
class WizardSession:
    seed: PersonaSeed
    answered: set[str] = field(default_factory=set)
    history: list[dict] = field(default_factory=list)
    stage: Literal["questioning", "generating", "done"] = "questioning"

    def to_dict(self) -> dict:
        return {
            "stage": self.stage,
            "answered": sorted(self.answered),
            "history": list(self.history),
            "seed": {
                "concept": self.seed.concept,
                "target_use": self.seed.target_use,
                "background_hint": self.seed.background_hint,
                "personality_hint": self.seed.personality_hint,
                "voice_hint": self.seed.voice_hint,
                "constraints": list(self.seed.constraints),
                "preferences": list(self.seed.preferences),
                "answers": dict(self.seed.answers),
            },
        }

    @classmethod
    def from_dict(cls, data: dict) -> "WizardSession":
        s = data["seed"]
        seed = PersonaSeed(
            concept=s["concept"],
            target_use=s.get("target_use", ""),
            background_hint=s.get("background_hint", ""),
            personality_hint=s.get("personality_hint", ""),
            voice_hint=s.get("voice_hint", ""),
            constraints=list(s.get("constraints", [])),
            preferences=list(s.get("preferences", [])),
            answers=dict(s.get("answers", {})),
        )
        return cls(
            seed=seed,
            answered=set(data.get("answered", [])),
            history=list(data.get("history", [])),
            stage=data.get("stage", "questioning"),
        )


class WizardEngine:
    """
    Stateful multi-turn wizard that collects missing persona fields before generating.

    Each call to `answer()` updates the internal session and returns the next
    batch of questions (or an empty list when enough info has been collected).
    Call `finish()` at any point to trigger generation.
    """

    def __init__(self, config: EngineConfig | None = None) -> None:
        self.config = config or EngineConfig()
        self._engine = PersonaEngine.create(self.config)
        self.session: WizardSession | None = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start(self, concept: str) -> list[Question]:
        """Initialize a new session for the given concept. Returns first batch of questions."""
        seed = PersonaSeed(concept=concept)
        self.session = WizardSession(seed=seed)
        return self._next_questions()

    def answer(self, field: str, zh: str, en: str = "") -> list[Question]:
        """
        Record the user's answer for `field` and return the next batch of questions.
        An empty list means no more questions — call `finish()` to generate.

        Required fields (background/personality/voice) reject empty/whitespace answers
        and return the same question again. Optional fields accept empty as a skip signal.

        `en` is optional; if omitted, the zh value is copied.
        """
        if self.session is None:
            raise RuntimeError("Call start() first")
        if self.session.stage != "questioning":
            raise RuntimeError("Session is no longer in questioning stage")

        value = zh.strip()
        if not value and field in REQUIRED_FIELDS:
            # Silently re-ask rather than silently skipping a required field
            return self._next_questions()

        self.session.answered.add(field)
        if value:
            self.session.seed.answers[field] = value
        self.session.history.append({"field": field, "zh": value, "en": (en.strip() or value)})

        # Also set the legacy hint fields for backward compat with generator
        if value:
            if field == "background":
                self.session.seed.background_hint = value
            elif field == "personality":
                self.session.seed.personality_hint = value
            elif field == "voice":
                self.session.seed.voice_hint = value

        return self._next_questions()

    def set_preferences(self, preferences: list[str]) -> None:
        """Set tag preferences (e.g. ["calm", "guardian"]) to influence inspiration card selection."""
        if self.session is None:
            raise RuntimeError("Call start() first")
        self.session.seed.preferences = preferences

    def set_target_use(self, target_use: str) -> None:
        """Describe the intended usage of the persona (e.g. 'daily companion bot')."""
        if self.session is None:
            raise RuntimeError("Call start() first")
        self.session.seed.target_use = target_use

    def finish(self) -> PersonaOutput:
        """Trigger persona generation using all collected answers. Returns full output."""
        if self.session is None:
            raise RuntimeError("Call start() first")
        self.session.stage = "generating"
        output = self._engine.generate(self.session.seed)
        self.session.stage = "done"
        return output

    def to_dict(self) -> dict:
        """Serialize the engine config and active session to a plain dict (JSON-safe).

        Note: llm_api_key is intentionally excluded. Pass it again to from_dict()
        if LLM mode is needed after restoring.
        """
        if self.session is None:
            raise RuntimeError("No active session — call start() before serializing")
        return {
            "version": "0.2.0",
            "config": {
                "candidate_count": self.config.candidate_count,
                "max_candidates_generate": self.config.max_candidates_generate,
                "long_target_chars": self.config.long_target_chars,
                "short_target_chars": self.config.short_target_chars,
                "diversity_threshold": self.config.diversity_threshold,
                "inspiration_per_candidate": self.config.inspiration_per_candidate,
                "random_seed": self.config.random_seed,
                "language": self.config.language,
                "llm_model": self.config.llm_model,
                "llm_temperature": self.config.llm_temperature,
                "llm_retries": self.config.llm_retries,
            },
            "session": self.session.to_dict(),
        }

    @classmethod
    def from_dict(cls, data: dict, llm_api_key: str | None = None) -> "WizardEngine":
        """Restore a WizardEngine from a previously serialized dict.

        Pass llm_api_key explicitly if the original session had LLM mode enabled,
        since the key is not stored in the serialized form.
        """
        cfg = data.get("config", {})
        config = EngineConfig(
            candidate_count=cfg.get("candidate_count", 3),
            max_candidates_generate=cfg.get("max_candidates_generate", 6),
            long_target_chars=cfg.get("long_target_chars", 900),
            short_target_chars=cfg.get("short_target_chars", 320),
            diversity_threshold=cfg.get("diversity_threshold", 0.6),
            inspiration_per_candidate=cfg.get("inspiration_per_candidate", 3),
            random_seed=cfg.get("random_seed"),
            language=cfg.get("language", "zh"),
            llm_model=cfg.get("llm_model", "claude-haiku-4-5-20251001"),
            llm_api_key=llm_api_key,
            llm_temperature=cfg.get("llm_temperature", 0.8),
            llm_retries=cfg.get("llm_retries", 1),
        )
        engine = cls(config=config)
        engine.session = WizardSession.from_dict(data["session"])
        return engine

    def pending_questions(self) -> list[Question]:
        """Return all outstanding questions without advancing session state."""
        if self.session is None:
            return []
        return self._next_questions()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _next_questions(self) -> list[Question]:
        """Return the next unanswered questions in priority order (max 2 at a time)."""
        if self.session is None:
            return []

        questions: list[Question] = []

        # Required fields first (up to 2 at a time, no skip hint)
        for field_name in WIZARD_FIELD_ORDER:
            if field_name in OPTIONAL_FIELDS:
                continue
            if field_name in self.session.answered:
                continue
            if field_name not in QUESTION_MAP:
                continue
            q_data = QUESTION_MAP[field_name]
            questions.append(
                Question(
                    id=f"q_{field_name}",
                    field=field_name,
                    zh=q_data["zh"],
                    en=q_data["en"],
                )
            )
            if len(questions) >= 2:
                break

        if questions:
            return questions

        # All required fields answered — ask optional fields one at a time
        for field_name in OPTIONAL_FIELDS:
            if field_name in self.session.answered:
                continue
            if field_name not in QUESTION_MAP:
                continue
            q_data = QUESTION_MAP[field_name]
            questions.append(
                Question(
                    id=f"q_{field_name}",
                    field=field_name,
                    zh=q_data["zh"] + "（可选，直接回车跳过）",
                    en=q_data["en"] + " (optional, press Enter to skip)",
                )
            )
            break  # One optional at a time

        return questions
