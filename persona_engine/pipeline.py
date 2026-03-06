from __future__ import annotations

import json
import time
import warnings
from dataclasses import dataclass
from pathlib import Path

from .compressor import compress_spec
from .config import EngineConfig
from .domain import PersonaCandidate, PersonaOutput, PersonaSeed, Question
from .formatter import render_natural, render_natural_card
from .generator import LLMGenerator
from .inspiration import InspirationLibrary
from .llm import create_llm_client
from .safety import detect_constraint_conflicts, safety_score_penalty, scan_spec
from .scorer import score_candidate, similarity
from .templates import TemplateLibrary
from .utils import rng

VERSION = "0.3.0"

_SCHEMA_PATH = Path(__file__).resolve().parent.parent / "schemas" / "persona_spec.schema.json"
_SCHEMA: dict | None = None


def _load_schema() -> dict | None:
    global _SCHEMA
    if _SCHEMA is None and _SCHEMA_PATH.exists():
        with _SCHEMA_PATH.open("r", encoding="utf-8") as f:
            _SCHEMA = json.load(f)
    return _SCHEMA


def _validate_output(output: "PersonaOutput", language: str | None = None) -> None:
    """Validate output against JSON schema if jsonschema is installed. Silently skips otherwise.

    Schema validation is skipped when a single language is selected since the
    bilingual schema expects both zh and en fields.
    """
    if language:
        return  # single-language output uses a different structure
    schema = _load_schema()
    if schema is None:
        return
    try:
        import jsonschema
        jsonschema.validate(output.as_dict(), schema)
    except ImportError:
        pass  # jsonschema not installed — skip validation
    except jsonschema.ValidationError as exc:
        import warnings
        warnings.warn(f"PersonaOutput schema validation failed: {exc.message}", stacklevel=3)

QUESTION_MAP = {
    "appearance": {
        "zh": "这个角色的外貌特征是什么？（如发色、瞳色、服装风格等）",
        "en": "What does this character look like? (hair, eyes, clothing style, etc.)",
    },
    "background": {
        "zh": "这个角色的背景故事/关键经历是什么？（如职业、经历或身世）",
        "en": "What is this character's background story? (occupation, experience, origin)",
    },
    "personality": {
        "zh": "这个角色最突出的性格特质有哪些？",
        "en": "What are the most distinctive personality traits?",
    },
    "voice": {
        "zh": "这个角色的说话风格/口癖是什么？（如语气、常用词或句尾习惯）",
        "en": "What is the character's speaking style and verbal habits? (tone, catchphrases, speech patterns)",
    },
    "goals": {
        "zh": "这个角色最想实现的目标或渴望是什么？",
        "en": "What is the character's primary goal or deepest desire?",
    },
    "conflicts": {
        "zh": "这个角色面临哪些内在冲突或外部阻力？",
        "en": "What inner conflicts or external tensions does this character face?",
    },
}


@dataclass
class PersonaEngine:
    config: EngineConfig
    inspirations: InspirationLibrary
    templates: TemplateLibrary

    @classmethod
    def create(cls, config: EngineConfig | None = None) -> "PersonaEngine":
        config = config or EngineConfig()
        inspirations = InspirationLibrary.load()
        templates = TemplateLibrary.load()
        return cls(config=config, inspirations=inspirations, templates=templates)

    def plan_questions(self, seed: PersonaSeed) -> list[Question]:
        questions: list[Question] = []
        required = {
            "appearance": None,
            "background": seed.background_hint,
            "personality": seed.personality_hint,
            "voice": seed.voice_hint,
            "goals": None,
            "conflicts": None,
        }
        for field, hint in required.items():
            # Skip if answered via hint or via seed.answers dict
            if hint or field in seed.answers:
                continue
            if field not in QUESTION_MAP:
                continue
            question = QUESTION_MAP[field]
            questions.append(
                Question(
                    id=f"q_{field}",
                    field=field,
                    zh=question["zh"],
                    en=question["en"],
                )
            )
        return questions

    def generate(self, seed: PersonaSeed) -> PersonaOutput:
        llm_client = create_llm_client(
            provider=self.config.llm_provider,
            model=self.config.llm_model,
            api_key=self.config.llm_api_key,
            base_url=self.config.llm_base_url,
            max_tokens=6400,
        )
        generator = LLMGenerator(llm_client, self.config, self.inspirations, self.templates)

        randomizer = rng(self.config.random_seed)
        questions = self.plan_questions(seed)
        t_start = time.monotonic()

        # --- Constraint conflict detection ---
        constraint_conflicts = detect_constraint_conflicts(seed.constraints)
        if constraint_conflicts:
            msgs = "; ".join(f"[{c.a} ↔ {c.b}] {c.reason}" for c in constraint_conflicts)
            warnings.warn(f"Constraint conflicts detected: {msgs}", stacklevel=2)

        # Generate exactly candidate_count to minimise API calls
        effective_generate = self.config.candidate_count

        # Rotate templates so each run avoids repeating the same template too soon
        template_pool = list(self.templates.templates)
        randomizer.shuffle(template_pool)
        rotated: list = []
        while len(rotated) < effective_generate:
            rotated.extend(template_pool)
        templates_for_run = rotated[:effective_generate]

        pool: list[tuple] = []
        for i in range(effective_generate):
            template = templates_for_run[i]
            cards = self.inspirations.select_cards(
                seed.preferences,
                self.config.inspiration_per_candidate,
                randomizer,
                selected_ids=seed.selected_inspirations or None,
            )
            spec, gen_context = generator.generate(seed, template, cards)
            score = score_candidate(spec, self.config)
            safety_flags = scan_spec(spec)
            if safety_flags:
                penalty = safety_score_penalty(safety_flags)
                score.value = max(0.0, score.value - penalty)
                high = [f for f in safety_flags if f.severity == "high"]
                if high:
                    warnings.warn(
                        f"High-severity safety flags in generated spec: "
                        + ", ".join(f"{f.field}/{f.lang}: {f.category}" for f in high),
                        stacklevel=2,
                    )
            pool.append((spec, gen_context, score, cards, template))

        pool.sort(key=lambda item: item[2].value, reverse=True)

        selected: list[tuple] = []
        for spec, gen_context, score, cards, template in pool:
            if len(selected) >= self.config.candidate_count:
                break
            if not selected:
                selected.append((spec, gen_context, score, cards, template))
                continue
            if all(similarity(spec, s[0]) < self.config.diversity_threshold for s in selected):
                selected.append((spec, gen_context, score, cards, template))

        if len(selected) < self.config.candidate_count:
            selected_ids = {id(item[0]) for item in selected}
            for item in pool:
                if id(item[0]) in selected_ids:
                    continue
                selected.append(item)
                selected_ids.add(id(item[0]))
                if len(selected) >= self.config.candidate_count:
                    break

        language = self.config.language
        template_ids_used: list[str] = []
        card_ids_used: list[str] = []
        candidates: list[PersonaCandidate] = []
        for idx, (spec, gen_context, score, cards, template) in enumerate(selected, start=1):
            spec_long = spec
            spec_short = compress_spec(spec, self.config)
            ctx_zh = gen_context.to_values("zh")
            ctx_en = gen_context.to_values("en")
            nc = render_natural_card(template.natural_card, spec_long, ctx_zh, ctx_en, language=language)
            natural_long = render_natural(spec_long, "long", natural_card=nc, language=language)
            natural_short = render_natural(spec_short, "short", natural_card=nc, language=language)
            candidates.append(
                PersonaCandidate(
                    id=f"cand_{idx}",
                    spec_long=spec_long,
                    spec_short=spec_short,
                    natural_long=natural_long,
                    natural_short=natural_short,
                    score=score.value,
                    tags=spec.tags,
                    sources=[card.id for card in cards],
                )
            )
            template_ids_used.append(template.id)
            card_ids_used.extend(card.id for card in cards)

        elapsed_ms = int((time.monotonic() - t_start) * 1000)
        output = PersonaOutput(candidates=candidates, questions=questions, meta={})
        _validate_output(output, language=language)
        meta = {
            "candidate_count": self.config.candidate_count,
            "language": self.config.language,
            "required_fields": list(self.config.required_fields),
            "template_ids_used": template_ids_used,
            "card_ids_used": card_ids_used,
            "generation_ms": elapsed_ms,
            "engine_version": VERSION,
            "constraint_conflicts": [
                {"a": c.a, "b": c.b, "reason": c.reason}
                for c in constraint_conflicts
            ],
        }

        output.meta = meta
        return output
