from __future__ import annotations

from dataclasses import dataclass, field

from .domain import LocalizedText
from .storage import load_json


@dataclass
class PersonaTemplate:
    id: str
    identity: LocalizedText
    appearance: LocalizedText
    background: LocalizedText
    personality: LocalizedText
    voice: LocalizedText
    catchphrases: LocalizedText
    goals: LocalizedText
    relationships: LocalizedText
    conflicts: LocalizedText
    habits: LocalizedText
    skills: LocalizedText
    values: LocalizedText
    taboos: LocalizedText
    dialogue_examples: LocalizedText
    opening_line: LocalizedText
    system_constraints: LocalizedText
    usage_notes: LocalizedText
    natural_card: LocalizedText


@dataclass
class TemplateLibrary:
    templates: list[PersonaTemplate] = field(default_factory=list)

    @classmethod
    def load(cls, filename: str = "templates.json") -> "TemplateLibrary":
        raw = load_json(filename)
        templates = [
            PersonaTemplate(
                id=item["id"],
                identity=LocalizedText(**item["identity"]),
                appearance=LocalizedText(**item.get("appearance", {"zh": "", "en": ""})),
                background=LocalizedText(**item["background"]),
                personality=LocalizedText(**item["personality"]),
                voice=LocalizedText(**item["voice"]),
                catchphrases=LocalizedText(**item.get("catchphrases", {"zh": "", "en": ""})),
                goals=LocalizedText(**item.get("goals", {"zh": "", "en": ""})),
                relationships=LocalizedText(**item.get("relationships", {"zh": "", "en": ""})),
                conflicts=LocalizedText(**item.get("conflicts", {"zh": "", "en": ""})),
                habits=LocalizedText(**item.get("habits", {"zh": "", "en": ""})),
                skills=LocalizedText(**item.get("skills", {"zh": "", "en": ""})),
                values=LocalizedText(**item.get("values", {"zh": "", "en": ""})),
                taboos=LocalizedText(**item.get("taboos", {"zh": "", "en": ""})),
                dialogue_examples=LocalizedText(**item.get("dialogue_examples", {"zh": "", "en": ""})),
                opening_line=LocalizedText(**item.get("opening_line", {"zh": "", "en": ""})),
                system_constraints=LocalizedText(**item.get("system_constraints", {"zh": "", "en": ""})),
                usage_notes=LocalizedText(**item.get("usage_notes", {"zh": "", "en": ""})),
                natural_card=LocalizedText(**item.get("natural_card", {"zh": "", "en": ""})),
            )
            for item in raw
        ]
        return cls(templates=templates)

    def pick(self, rnd) -> PersonaTemplate:
        return rnd.choice(self.templates)
