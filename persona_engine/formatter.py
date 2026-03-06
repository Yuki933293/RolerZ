from __future__ import annotations

from .domain import LocalizedText, PersonaSpec
from .utils import safe_format


# Fields used in the long (full) card
LONG_FIELDS = [
    ("identity",           "身份",         "Identity"),
    ("appearance",         "外貌与基本信息", "Appearance"),
    ("background",         "背景故事",      "Background"),
    ("personality",        "性格与行为准则", "Personality"),
    ("voice",              "说话风格",      "Speech Style"),
    ("catchphrases",       "口癖与常用语",   "Catchphrases"),
    ("goals",              "目标与渴望",    "Goals"),
    ("relationships",      "与你的关系及互动规则", "Relationship & Interaction"),
    ("conflicts",          "内在冲突",      "Inner Conflicts"),
    ("habits",             "习惯",          "Habits"),
    ("skills",             "能力",          "Skills"),
    ("values",             "价值观",        "Values"),
    ("taboos",             "禁忌",          "Taboos"),
    ("dialogue_examples",  "示例对话",       "Example Dialogues"),
    ("opening_line",       "开场白",        "Opening Line"),
    ("system_constraints", "系统约束（防跳戏协议）", "System Constraints"),
]

# Fields used in the short (compressed) card
SHORT_FIELDS = [
    ("identity",     "身份",         "Identity"),
    ("appearance",   "外貌与基本信息", "Appearance"),
    ("background",   "背景故事",      "Background"),
    ("personality",  "性格与行为准则", "Personality"),
    ("voice",        "说话风格",      "Speech Style"),
    ("catchphrases", "口癖与常用语",   "Catchphrases"),
    ("relationships","与你的关系及互动规则", "Relationship & Interaction"),
    ("opening_line", "开场白",        "Opening Line"),
    ("system_constraints", "系统约束（防跳戏协议）", "System Constraints"),
]


def render_natural_card(
    natural_card_template: LocalizedText,
    spec: PersonaSpec,
    context_zh: dict[str, str],
    context_en: dict[str, str],
    language: str | None = None,
) -> dict[str, str]:
    """Render the one-line natural card summary using template + context + rendered spec fields."""
    result: dict[str, str] = {}
    langs = [language] if language else ["zh", "en"]

    for lang in langs:
        ctx = dict(context_zh if lang == "zh" else context_en)
        for field_name, _, _ in LONG_FIELDS:
            val = getattr(spec, field_name, None)
            if val and isinstance(val, LocalizedText):
                text = getattr(val, lang)
                if text:
                    ctx[field_name] = text
        tmpl = getattr(natural_card_template, lang)
        result[lang] = safe_format(tmpl, ctx)

    return result


def _render_lang(
    spec: PersonaSpec,
    fields: list[tuple[str, str, str]],
    lang: str,
    natural_card: dict[str, str] | None,
    char_name: str,
) -> str:
    """Render one language side as a bold-section character card."""
    lines: list[str] = []

    # Title line using identity or character name
    identity_val = getattr(spec, "identity", None)
    if lang == "zh":
        title = identity_val.zh if (identity_val and identity_val.zh) else char_name
        lines.append(f"**角色卡：{title}**")
    else:
        title = identity_val.en if (identity_val and identity_val.en) else char_name
        lines.append(f"**Character Card: {title}**")
    lines.append("")

    # Prepend natural_card summary if available
    if natural_card:
        card_text = natural_card.get(lang, "")
        if card_text:
            lines.append(card_text)
            lines.append("")

    # Render each section (skip identity since it's the title, and skip empty)
    for key, zh_label, en_label in fields:
        if key == "identity":
            continue
        val = getattr(spec, key, None)
        text = (val.zh if lang == "zh" else val.en) if val else ""
        if not text:
            continue
        label = zh_label if lang == "zh" else en_label
        lines.append(f"**{label}**")
        lines.append(text)
        lines.append("")

    return "\n".join(lines).rstrip()


def render_natural(
    spec: PersonaSpec,
    version: str,
    natural_card: dict[str, str] | None = None,
    char_name: str = "",
    language: str | None = None,
) -> dict[str, str]:
    fields = SHORT_FIELDS if version == "short" else LONG_FIELDS
    langs = [language] if language else ["zh", "en"]
    result: dict[str, str] = {}
    for lang in langs:
        result[lang] = _render_lang(spec, fields, lang, natural_card, char_name)
    return result
