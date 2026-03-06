from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .domain import LocalizedText
from .storage import load_json
from .utils import dedupe_preserve


@dataclass
class InspirationCard:
    id: str
    title: LocalizedText
    category: str
    tags: list[str]
    snippets: dict[str, LocalizedText]
    prompt_fragment: LocalizedText


@dataclass
class InspirationLibrary:
    cards: list[InspirationCard] = field(default_factory=list)

    @classmethod
    def load(cls, filename: str = "inspiration_cards.json") -> "InspirationLibrary":
        raw = load_json(filename)
        cards = [
            InspirationCard(
                id=item["id"],
                title=LocalizedText(**item["title"]),
                category=item.get("category", ""),
                tags=list(item.get("tags", [])),
                snippets={
                    key: LocalizedText(**value)
                    for key, value in item.get("snippets", {}).items()
                },
                prompt_fragment=LocalizedText(**item.get("prompt_fragment", {"zh": "", "en": ""})),
            )
            for item in raw
        ]
        return cls(cards=cards)

    def select_cards(
        self,
        preferences: list[str],
        count: int,
        rnd,
        selected_ids: list[str] | None = None,
    ) -> list[InspirationCard]:
        if not self.cards:
            return []

        # If user explicitly selected cards, use those first
        pinned: list[InspirationCard] = []
        if selected_ids:
            id_map = {card.id: card for card in self.cards}
            for cid in selected_ids:
                if cid in id_map and id_map[cid] not in pinned:
                    pinned.append(id_map[cid])

        remaining_count = count - len(pinned)
        if remaining_count <= 0:
            return pinned[:count]

        # Fill remaining slots via preference scoring or random
        pool = [card for card in self.cards if card not in pinned]
        if not preferences:
            extras = rnd.sample(pool, k=min(remaining_count, len(pool)))
        else:
            pref_set = set(preferences)
            scored = sorted(pool, key=lambda c: len(pref_set & set(c.tags)), reverse=True)
            extras = scored[:remaining_count]
            if len(extras) < remaining_count:
                rest = [c for c in pool if c not in extras]
                extras.extend(rnd.sample(rest, k=min(remaining_count - len(extras), len(rest))))

        return pinned + extras

    def collect_tags(self, cards: list[InspirationCard]) -> list[str]:
        tags: list[str] = []
        for card in cards:
            tags.extend(card.tags)
        return dedupe_preserve(tags)

    def collect_snippets(self, cards: list[InspirationCard]) -> dict[str, LocalizedText]:
        snippets: dict[str, LocalizedText] = {}
        for card in cards:
            for key, value in card.snippets.items():
                if key not in snippets or (not snippets[key].zh and value.zh):
                    snippets[key] = value
        return snippets
