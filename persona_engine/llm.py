from __future__ import annotations

import json
import os
from abc import ABC, abstractmethod

from .domain import LocalizedText, PersonaSeed, PersonaSpec
from .inspiration import InspirationCard
from .templates import PersonaTemplate
from .utils import is_cjk


class LLMClient(ABC):
    @abstractmethod
    def generate(self, prompt: str, system: str | None = None, temperature: float = 0.7) -> str:
        raise NotImplementedError


class NullLLMClient(LLMClient):
    def generate(self, prompt: str, system: str | None = None, temperature: float = 0.7) -> str:
        raise RuntimeError("LLM client not configured")


class OpenAICompatibleClient(LLMClient):
    """OpenAI-compatible client — works with OpenAI, DeepSeek, Qwen, and any custom endpoint."""

    def __init__(
        self,
        model: str = "gpt-4o-mini",
        api_key: str | None = None,
        base_url: str | None = None,
        max_tokens: int = 12800,
    ) -> None:
        try:
            import openai
        except ImportError as exc:
            raise ImportError(
                "openai package is required for this provider. Install with: pip install openai"
            ) from exc
        self._client = openai.OpenAI(api_key=api_key, base_url=base_url, timeout=60)
        self.model = model
        self.max_tokens = max_tokens

    def generate(self, prompt: str, system: str | None = None, temperature: float = 0.7) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self.max_tokens,
                temperature=temperature,
            )
        except ImportError as exc:
            if "socksio" in str(exc):
                raise ImportError(
                    "检测到系统 SOCKS 代理，但缺少必要依赖。\n"
                    "请运行：pip install 'httpx[socks]'\n"
                    "Detected SOCKS proxy. Run: pip install 'httpx[socks]'"
                ) from exc
            raise
        content = response.choices[0].message.content
        return content if content is not None else ""


# Default model for each provider
PROVIDER_DEFAULTS: dict[str, str] = {
    "claude": "claude-haiku-4-5-20251001",
    "openai": "gpt-4o-mini",
    "deepseek": "deepseek-chat",
}

# Pre-configured base URLs for known OpenAI-compatible providers
_PROVIDER_BASE_URLS: dict[str, str] = {
    "deepseek": "https://api.deepseek.com",
}


def create_llm_client(
    provider: str = "claude",
    model: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
    max_tokens: int = 12800,
) -> LLMClient:
    """
    Factory that returns the right LLMClient for the given provider.

    Supported providers:
      - "claude"   — Anthropic Claude (requires anthropic package + ANTHROPIC_API_KEY)
      - "openai"   — OpenAI GPT (requires openai package + OPENAI_API_KEY)
      - "deepseek" — DeepSeek (requires openai package + DEEPSEEK_API_KEY)
      - "custom"   — Any OpenAI-compatible endpoint; pass base_url explicitly
    """
    resolved_model = model or PROVIDER_DEFAULTS.get(provider, "gpt-4o-mini")

    if provider == "claude":
        return ClaudeClient(model=resolved_model, api_key=api_key, max_tokens=max_tokens)

    resolved_base_url = base_url or _PROVIDER_BASE_URLS.get(provider)
    resolved_api_key = api_key or (
        os.environ.get("OPENAI_API_KEY") if provider == "openai"
        else os.environ.get("DEEPSEEK_API_KEY") if provider == "deepseek"
        else None
    )
    return OpenAICompatibleClient(
        model=resolved_model,
        api_key=resolved_api_key,
        base_url=resolved_base_url,
        max_tokens=max_tokens,
    )


class ClaudeClient(LLMClient):
    def __init__(
        self,
        model: str = "claude-haiku-4-5-20251001",
        api_key: str | None = None,
        max_tokens: int = 12800,
    ) -> None:
        try:
            import anthropic
        except ImportError as exc:
            raise ImportError(
                "使用 claude provider 需要安装 anthropic 包。\n"
                "请运行：pip install anthropic\n"
                "Run: pip install anthropic"
            ) from exc
        self._client = anthropic.Anthropic(
            api_key=api_key or os.environ.get("ANTHROPIC_API_KEY"),
            timeout=60,
        )
        self.model = model
        self.max_tokens = max_tokens

    def generate(self, prompt: str, system: str | None = None, temperature: float = 0.7) -> str:
        kwargs: dict = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            kwargs["system"] = system
        try:
            response = self._client.messages.create(**kwargs)
        except ImportError as exc:
            if "socksio" in str(exc):
                raise ImportError(
                    "检测到系统 SOCKS 代理，但缺少必要依赖。\n"
                    "请运行：pip install 'httpx[socks]'\n"
                    "Detected SOCKS proxy. Run: pip install 'httpx[socks]'"
                ) from exc
            raise
        return response.content[0].text


PERSONA_SYSTEM_PROMPT_ZH = """\
你是一名专业角色卡设计师（Character Card Architect），擅长为虚拟角色（AI伴侣、游戏NPC、小说人物等）创作生动立体的角色设定。
你的角色卡需要包含：外貌、背景、性格、说话风格与口癖、示例对话、开场白、系统约束（防跳戏协议）。
你的输出必须严格遵循 JSON 格式，不得包含任何 JSON 以外的文本。
"""

PERSONA_SYSTEM_PROMPT_EN = """\
You are a professional Character Card Architect, specializing in creating vivid, multi-dimensional character profiles for virtual characters (AI companions, game NPCs, novel characters, etc.).
Your character card must include: appearance, background, personality, speech style & catchphrases, example dialogues, opening line, and system constraints (anti-breaking-character protocol).
Output only valid JSON, no extra text.
"""

def get_system_prompt(language: str = "zh") -> str:
    return PERSONA_SYSTEM_PROMPT_EN if language == "en" else PERSONA_SYSTEM_PROMPT_ZH


def build_persona_prompt(
    seed: PersonaSeed,
    template: PersonaTemplate,
    cards: list[InspirationCard],
    language: str = "zh",
) -> str:
    """Build a structured prompt that asks the LLM to fill all persona spec fields in the target language."""
    lang = language  # "zh" or "en"

    card_fragments = "\n".join(
        f"- [{card.category}] {getattr(card.title, lang)}: "
        f"{getattr(card.prompt_fragment, lang)}"
        for card in cards
        if getattr(card.prompt_fragment, lang)
    )

    field_guidance = {
        "identity": getattr(template.identity, lang),
        "appearance": (getattr(template.appearance, lang) if getattr(template, "appearance", None) else
                       ("（外貌与基本信息）" if lang == "zh" else "(Appearance & basic info)")),
        "background": getattr(template.background, lang),
        "personality": getattr(template.personality, lang),
        "voice": getattr(template.voice, lang),
        "catchphrases": (getattr(template.catchphrases, lang) if getattr(template, "catchphrases", None) else
                         ("（口癖与常用语）" if lang == "zh" else "(Catchphrases & verbal habits)")),
        "goals": getattr(template.goals, lang),
        "relationships": getattr(template.relationships, lang),
        "conflicts": getattr(template.conflicts, lang),
        "habits": getattr(template.habits, lang),
        "skills": getattr(template.skills, lang),
        "values": getattr(template.values, lang),
        "taboos": getattr(template.taboos, lang),
        "dialogue_examples": (getattr(template.dialogue_examples, lang) if getattr(template, "dialogue_examples", None) else
                              ("（示例对话：2-3组问答）" if lang == "zh" else "(Example dialogues: 2-3 Q&A pairs)")),
        "opening_line": (getattr(template.opening_line, lang) if getattr(template, "opening_line", None) else
                         ("（角色开场白）" if lang == "zh" else "(Character opening line)")),
        "system_constraints": (getattr(template.system_constraints, lang) if getattr(template, "system_constraints", None) else
                               ("（系统约束/防跳戏协议）" if lang == "zh" else "(System constraints / anti-breaking-character protocol)")),
    }

    # Build answers section
    answers_section = ""
    if seed.answers:
        header = "## 用户已填写的设定" if lang == "zh" else "## User-Provided Settings"
        answers_section = f"\n{header}\n" + "\n".join(
            f"{k}: {v}" for k, v in seed.answers.items()
        )

    if lang == "zh":
        return f"""\
请为以下角色概念创作一份完整的角色卡（Character Card）。所有内容使用中文。

## 角色概念
{seed.concept}

## 用途说明
{seed.target_use or "通用 AI 角色扮演 / AI伴侣"}

## 用户提示
外貌提示: {seed.answers.get("appearance") or "无"}
背景提示: {seed.background_hint or seed.answers.get("background") or "无"}
性格提示: {seed.personality_hint or seed.answers.get("personality") or "无"}
语气/口癖提示: {seed.voice_hint or seed.answers.get("voice") or "无"}
额外约束: {", ".join(seed.constraints) if seed.constraints else "无"}
{answers_section}

## 灵感参考（请融入但不要直接复制）
{card_fragments or "无灵感卡"}

## 模板风格参考
{json.dumps(field_guidance, ensure_ascii=False, indent=2)}

## 输出要求
输出一个 JSON 对象，包含以下字段，每个字段的值是中文字符串：
identity, appearance, background, personality, voice, catchphrases,
goals, relationships, conflicts, habits, skills, values, taboos,
dialogue_examples, opening_line, system_constraints

另外输出 "tags" 字段（字符串列表，5-8 个英文标签描述关键特质）。

字段说明：
- appearance: 外貌与基本信息（发色、瞳色、服装风格、体型等）
- catchphrases: 口癖与常用语（3-5个标志性口头语或句式）
- dialogue_examples: 示例对话（2-3组，格式：> 用户：xxx\\n> {seed.concept[:8]}：xxx）
- opening_line: 角色主动说出的第一句开场白（带动作描写）
- system_constraints: 系统约束/防跳戏协议（3-4条规则，确保角色一致性）

示例格式:
{{
  "identity": "某某，一位沉默寡言的城市治愈者",
  "appearance": "身材纤细，留着一头栗色长发...",
  "catchphrases": "口头禅：「哼，才不是呢」「随你怎么想」",
  "dialogue_examples": "> 用户：「你好。」\\n> 角色：（侧过头，假装没听见）「……哦。你来了。」",
  "opening_line": "（抱着手臂，侧过脸不直视你）「……嗯。你还要在那里站多久？」",
  "system_constraints": "1. 始终保持傲娇设定，不会主动示弱。\\n2. 互动基于现代日常背景。\\n3. 不会扮演角色以外的身份。",
  "tags": ["tsundere", "healer", "urban"]
}}
"""
    else:
        return f"""\
Create a complete Character Card for the following character concept. All content in English.

## Character Concept
{seed.concept}

## Intended Use
{seed.target_use or "General AI role-play / AI companion"}

## User Hints
Appearance hint: {seed.answers.get("appearance") or "None"}
Background hint: {seed.background_hint or seed.answers.get("background") or "None"}
Personality hint: {seed.personality_hint or seed.answers.get("personality") or "None"}
Voice/catchphrase hint: {seed.voice_hint or seed.answers.get("voice") or "None"}
Extra constraints: {", ".join(seed.constraints) if seed.constraints else "None"}
{answers_section}

## Inspiration Reference (incorporate but don't copy directly)
{card_fragments or "No inspiration cards"}

## Template Style Reference
{json.dumps(field_guidance, ensure_ascii=False, indent=2)}

## Output Requirements
Output a JSON object with the following fields, each field value is an English string:
identity, appearance, background, personality, voice, catchphrases,
goals, relationships, conflicts, habits, skills, values, taboos,
dialogue_examples, opening_line, system_constraints

Also include a "tags" field (string list, 5-8 English tags describing key traits).

Field descriptions:
- appearance: Physical appearance & basic info (hair, eyes, clothing style, build, etc.)
- catchphrases: Verbal habits & catchphrases (3-5 signature phrases or speech patterns)
- dialogue_examples: Example dialogues (2-3 pairs, format: > User: xxx\\n> {seed.concept[:8]}: xxx)
- opening_line: Character's first opening line (with action description)
- system_constraints: System constraints / anti-breaking-character rules (3-4 rules for character consistency)

Example format:
{{
  "identity": "Someone, a silent urban healer",
  "appearance": "Slender figure, chestnut hair...",
  "catchphrases": "Says things like 'Hmph, that's not it' and 'Think whatever you want'",
  "dialogue_examples": "> You: 'Hello.'\\n> Char: (turning away, pretending not to hear) '...Oh. You're here.'",
  "opening_line": "(arms crossed, looking away) '...Fine. How long are you going to stand there?'",
  "system_constraints": "1. Always maintain the tsundere persona.\\n2. Interactions set in modern daily life.\\n3. Never breaks character.",
  "tags": ["tsundere", "healer", "urban"]
}}
"""


_REQUIRED_LLM_FIELDS = ("background", "personality", "voice")


def _strip_code_fence(text: str) -> str:
    """Strip markdown code fences (```json ... ```) if present."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        end = -1 if lines[-1].strip() == "```" else len(lines)
        text = "\n".join(lines[1:end])
    return text.strip()


def parse_llm_response(response_text: str, language: str = "zh") -> PersonaSpec | None:
    """
    Parse LLM JSON response into a PersonaSpec.

    Supports two formats:
    - Single-language: field values are plain strings (new, preferred)
    - Bilingual: field values are {"zh": ..., "en": ...} dicts (legacy)

    Returns None if JSON is invalid or any required field (background/personality/voice)
    is missing or empty.
    """
    try:
        data = json.loads(_strip_code_fence(response_text))
    except (json.JSONDecodeError, ValueError):
        return None

    if not isinstance(data, dict):
        return None

    def _lt(key: str) -> LocalizedText:
        raw = data.get(key, "")
        # Legacy bilingual format: {"zh": ..., "en": ...}
        if isinstance(raw, dict):
            return LocalizedText(zh=str(raw.get("zh", "")), en=str(raw.get("en", "")))
        # Single-language format: plain string → fill into the target language side
        text = str(raw) if raw else ""
        if language == "en":
            return LocalizedText(en=text)
        return LocalizedText(zh=text)

    # Validate required fields
    for field in _REQUIRED_LLM_FIELDS:
        lt = _lt(field)
        if not lt.zh and not lt.en:
            return None

    return PersonaSpec(
        identity=_lt("identity"),
        appearance=_lt("appearance"),
        background=_lt("background"),
        personality=_lt("personality"),
        voice=_lt("voice"),
        catchphrases=_lt("catchphrases"),
        goals=_lt("goals"),
        relationships=_lt("relationships"),
        conflicts=_lt("conflicts"),
        habits=_lt("habits"),
        skills=_lt("skills"),
        values=_lt("values"),
        taboos=_lt("taboos"),
        dialogue_examples=_lt("dialogue_examples"),
        opening_line=_lt("opening_line"),
        system_constraints=_lt("system_constraints"),
        tags=[str(t) for t in data.get("tags", []) if isinstance(t, str)],
    )


def build_repair_prompt(broken_response: str, language: str = "zh") -> str:
    """Build a repair prompt when the previous LLM response was not valid JSON."""
    if language == "zh":
        return f"""\
上一次你的回复不是合法的 JSON，或缺少必填字段（background/personality/voice）。

以下是你上一次的回复：
---
{broken_response[:1500]}
---

请仅输出一个合法的 JSON 对象（不含任何其他文字），包含所有要求的字段：
identity, appearance, background, personality, voice, catchphrases,
goals, relationships, conflicts, habits, skills, values, taboos,
dialogue_examples, opening_line, system_constraints, tags

每个字段（除 tags 外）的值是中文字符串。tags 是英文字符串列表。
"""
    else:
        return f"""\
Your previous response was not valid JSON, or was missing required fields (background/personality/voice).

Your previous response:
---
{broken_response[:1500]}
---

Output ONLY a valid JSON object (no extra text) with all required fields:
identity, appearance, background, personality, voice, catchphrases,
goals, relationships, conflicts, habits, skills, values, taboos,
dialogue_examples, opening_line, system_constraints, tags

Each field (except tags) must be an English string. tags is a list of English strings.
"""
