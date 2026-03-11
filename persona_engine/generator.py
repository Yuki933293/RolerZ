from __future__ import annotations

import re
from dataclasses import dataclass

from .config import EngineConfig
from .domain import LocalizedText, PersonaSeed, PersonaSpec
from .inspiration import InspirationCard, InspirationLibrary
from .templates import PersonaTemplate, TemplateLibrary


def _check_placeholder_leaks(spec: PersonaSpec) -> list[str]:
    """Return a list of unresolved {placeholder} tokens found in any spec field."""
    pattern = re.compile(r"\{[a-zA-Z0-9_]+\}")
    leaks: list[str] = []
    for field_name, value in spec.__dict__.items():
        if hasattr(value, "zh") and hasattr(value, "en"):
            for text in (value.zh, value.en):
                found = pattern.findall(text)
                if found:
                    leaks.extend(f"{field_name}: {f}" for f in found)
    return leaks


@dataclass
class GenerationContext:
    values: dict[str, LocalizedText]

    def to_values(self, lang: str) -> dict[str, str]:
        return {key: getattr(value, lang) for key, value in self.values.items()}


class LLMGenerator:
    """LLM-powered persona generator."""

    def __init__(
        self,
        llm_client,  # LLMClient
        config: EngineConfig,
        inspirations: InspirationLibrary,
        templates: TemplateLibrary,
    ) -> None:
        self.llm = llm_client
        self.config = config
        self.inspirations = inspirations
        self.templates = templates

    def _build_context(self, seed: PersonaSeed, cards: list[InspirationCard]) -> GenerationContext:
        """Build a minimal context for natural_card rendering (used post-LLM)."""
        values: dict[str, LocalizedText] = {}
        for card in cards:
            for key, snippet in card.snippets.items():
                values[key] = snippet
        if seed.concept:
            values["role"] = LocalizedText(zh=seed.concept, en=seed.concept)
        if seed.target_use:
            values["goal"] = LocalizedText(zh=seed.target_use, en=seed.target_use)
        for field, answer in seed.answers.items():
            values[field] = LocalizedText(zh=answer, en=answer)
        return GenerationContext(values=values)

    def generate(
        self, seed: PersonaSeed, template: PersonaTemplate, cards: list[InspirationCard]
    ) -> tuple[PersonaSpec, GenerationContext]:
        from .llm import (
            build_persona_prompt,
            build_repair_prompt,
            get_system_prompt,
            parse_llm_response,
        )

        language = self.config.language
        ctx = self._build_context(seed, cards)
        temperature = self.config.llm_temperature
        top_p = self.config.llm_top_p
        frequency_penalty = self.config.llm_frequency_penalty
        presence_penalty = self.config.llm_presence_penalty
        max_attempts = 1 + max(0, self.config.llm_retries)
        system_prompt = get_system_prompt(language)

        raw: str | None = None
        last_error: Exception | None = None

        for attempt in range(max_attempts):
            try:
                if attempt == 0:
                    prompt = build_persona_prompt(seed, template, cards, language=language)
                else:
                    prompt = build_repair_prompt(raw or "", language=language)
                raw = self.llm.generate(
                    prompt, system=system_prompt, temperature=temperature,
                    top_p=top_p, frequency_penalty=frequency_penalty,
                    presence_penalty=presence_penalty,
                )
                spec = parse_llm_response(raw, language=language)
                if spec is not None:
                    spec.tags = self.inspirations.collect_tags(cards)
                    if not _check_placeholder_leaks(spec):
                        return spec, ctx
                last_error = ValueError("LLM returned invalid or incomplete JSON")
            except Exception as exc:
                last_error = exc

        raise RuntimeError(
            f"LLM generation failed after {max_attempts} attempt(s): {last_error}"
        ) from last_error
