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
    "claude":      "claude-haiku-4-5-20251001",
    "openai":      "gpt-4o-mini",
    "gemini":      "gemini-2.0-flash",
    "deepseek":    "deepseek-chat",
    "xai":         "grok-3-mini-fast",
    "moonshot":    "moonshot-v1-8k",
    "zhipu":       "glm-4-flash",
    "groq":        "llama-3.3-70b-versatile",
    "openrouter":  "openai/gpt-4o-mini",
    "siliconflow": "Qwen/Qwen2.5-7B-Instruct",
    "302ai":       "gpt-4o-mini",
    "aihubmix":    "gpt-4o-mini",
    "nvidia":      "meta/llama-3.1-8b-instruct",
}

# Pre-configured base URLs for known OpenAI-compatible providers
_PROVIDER_BASE_URLS: dict[str, str] = {
    "deepseek":    "https://api.deepseek.com",
    "gemini":      "https://generativelanguage.googleapis.com/v1beta/openai",
    "xai":         "https://api.x.ai/v1",
    "moonshot":    "https://api.moonshot.cn/v1",
    "zhipu":       "https://open.bigmodel.cn/api/paas/v4",
    "groq":        "https://api.groq.com/openai/v1",
    "openrouter":  "https://openrouter.ai/api/v1",
    "siliconflow": "https://api.siliconflow.cn/v1",
    "302ai":       "https://api.302.ai/v1",
    "aihubmix":    "https://aihubmix.com/v1",
    "nvidia":      "https://integrate.api.nvidia.com/v1",
    "ollama":      "http://localhost:11434/v1",
    "lmstudio":    "http://localhost:1234/v1",
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
    Supports claude, openai, gemini, deepseek, xai, moonshot, zhipu, groq,
    openrouter, siliconflow, 302ai, aihubmix, nvidia, azure, ollama, lmstudio,
    and custom (any OpenAI-compatible endpoint).
    """
    resolved_model = model or PROVIDER_DEFAULTS.get(provider, "gpt-4o-mini")

    if provider == "claude":
        return ClaudeClient(model=resolved_model, api_key=api_key, max_tokens=max_tokens)

    resolved_base_url = base_url or _PROVIDER_BASE_URLS.get(provider)

    # Env key lookup per provider
    _ENV_KEYS: dict[str, str] = {
        "openai": "OPENAI_API_KEY", "gemini": "GEMINI_API_KEY",
        "deepseek": "DEEPSEEK_API_KEY", "xai": "XAI_API_KEY",
        "moonshot": "MOONSHOT_API_KEY", "zhipu": "ZHIPU_API_KEY",
        "groq": "GROQ_API_KEY", "openrouter": "OPENROUTER_API_KEY",
        "siliconflow": "SILICONFLOW_API_KEY", "302ai": "API_302AI_KEY",
        "aihubmix": "AIHUBMIX_API_KEY", "nvidia": "NVIDIA_API_KEY",
        "azure": "AZURE_OPENAI_API_KEY",
    }
    resolved_api_key = api_key or (
        os.environ.get(_ENV_KEYS[provider]) if provider in _ENV_KEYS else None
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
你是一名角色卡设计师，擅长为虚拟角色（AI伴侣、游戏NPC、小说人物等）创作角色设定。

## 写作原则
- 像描述一个你认识的真人一样写，不要写成人物分析报告
- 用具体的场景和细节代替抽象的性格标签（不要写"性格温柔"，写"别人说重话时会先沉默几秒再回应"）
- 避免使用 ACG/二次元术语（傲娇、病娇、腹黑、反差萌等），用日常语言描述
- 不要过度戏剧化，真实的人有平淡的一面
- 口癖和说话风格要自然，不要写成标签式的口头禅（不要"才不是为了你呢"这类模板化台词）
- 每个角色应该有自己独特的矛盾点，而不是"表面A实际B"的统一公式

## 输出要求
输出严格遵循 JSON 格式，不得包含任何 JSON 以外的文本。
"""

PERSONA_SYSTEM_PROMPT_EN = """\
You are a character card designer, specializing in creating character profiles for virtual characters (AI companions, game NPCs, novel characters, etc.).

## Writing Principles
- Write as if describing a real person you know, not a character analysis report
- Use concrete scenes and details instead of abstract personality labels (don't write "gentle personality", write "pauses a few seconds before responding when someone speaks harshly")
- Avoid anime/ACG terminology (tsundere, yandere, kuudere, gap moe, etc.) — use everyday language
- Don't over-dramatize; real people have mundane sides too
- Speech patterns and catchphrases should feel natural, not template-like stock phrases
- Each character should have their own unique contradictions, not a one-size-fits-all "appears A but is actually B" formula

## Output Requirements
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
请为以下角色概念创作一份完整的角色卡。所有内容使用中文。

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

## 灵感参考（融入角色但不要照搬原文）
{card_fragments or "无灵感卡"}

## 模板风格参考
{json.dumps(field_guidance, ensure_ascii=False, indent=2)}

## 输出要求
输出一个 JSON 对象，包含以下字段，每个字段的值是中文字符串：
identity, appearance, background, personality, voice, catchphrases,
goals, relationships, conflicts, habits, skills, values, taboos,
dialogue_examples, opening_line, system_constraints

另外输出 "tags" 字段（字符串列表，5-8 个英文标签描述关键特质）。

## 字段说明
- identity: 一句话介绍角色是谁（姓名 + 身份）
- appearance: 外貌描写要具体，包括五官特征、穿衣偏好、给人的第一印象
- background: 写成经历而非简历，重点写塑造这个人的关键事件
- personality: 用行为举例来体现性格，不要堆性格形容词
- voice: 描述说话的节奏、用词偏好、情绪表达方式，而不是列口头禅
- catchphrases: 3-5句这个角色会说的话，要像真人会说的，不要模板化
- dialogue_examples: 2-3组对话示例（格式：> 用户：xxx\\n> 角色：xxx），展现角色在不同情绪下的反应
- opening_line: 角色主动说出的第一句话（带动作或场景描写）
- system_constraints: 3-4条维持角色一致性的规则

## 写作要求（重要）
- personality 字段：不要写"外表X内心Y"的公式，写这个人具体会怎么做、怎么反应
- voice 字段：描述说话习惯（语速、用词倾向、情绪变化），不要只列口头禅
- catchphrases 字段：写这个人在具体场景下会说的真实的话
- opening_line：要有场景感，让人能想象出画面
- 所有描写要像在讲一个你认识的人，不是在填表格

示例格式:
{{
  "identity": "林北，社区诊所的夜班医生",
  "appearance": "总穿着洗到发白的白大褂，左手无名指有一道旧烫伤。头发经常因为连续值班而乱糟糟的，但眼睛很亮。",
  "personality": "对病人的症状描述听得很认真，但一转头跟同事说话就变得很随意。遇到需要做决定的时候不犹豫，但事后会一个人反复想自己有没有做错。",
  "voice": "说话简短，不太会绕弯子。跟不熟的人语气偏公事公办，跟信任的人会突然冒出几句冷笑话。紧张的时候反而更平静，因为习惯了在急诊环境下工作。",
  "catchphrases": "「先坐下，慢慢说。」「吃药了吗？」「没什么大事，但你得注意休息。」「行了，别在这站着了。」",
  "dialogue_examples": "> 用户：「我最近总是睡不着。」\\n> 林北：（停下手里的笔，看了你一眼）「多久了？」\\n\\n> 用户：「你每天都这么晚下班吗？」\\n> 林北：「习惯了。夜班安静，适合想事情。——你怎么还没回去？」",
  "opening_line": "（从诊室里走出来，手里还拿着一杯凉掉的咖啡）「挂号了吗？没挂也没关系，先说说怎么了。」",
  "system_constraints": "1. 保持医生的职业习惯——问诊式的对话节奏，先了解情况再给建议。\\n2. 不轻易表露私人情绪，但在信任建立后会自然流露。\\n3. 不会做出超越医患关系的承诺，但会用行动表示关心。",
  "tags": ["doctor", "night-shift", "calm", "reserved", "observant"]
}}
"""
    else:
        return f"""\
Create a complete character card for the following concept. All content in English.

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

## Inspiration Reference (weave into the character, don't copy verbatim)
{card_fragments or "No inspiration cards"}

## Template Style Reference
{json.dumps(field_guidance, ensure_ascii=False, indent=2)}

## Output Requirements
Output a JSON object with the following fields, each field value is an English string:
identity, appearance, background, personality, voice, catchphrases,
goals, relationships, conflicts, habits, skills, values, taboos,
dialogue_examples, opening_line, system_constraints

Also include a "tags" field (string list, 5-8 English tags describing key traits).

## Field Descriptions
- identity: One-line intro — who is this person (name + role)
- appearance: Concrete physical details — features, clothing preferences, first impression they give
- background: Write as lived experience, not a resume; focus on formative events
- personality: Show personality through behavior examples, not adjective lists
- voice: Describe speech rhythm, word choice tendencies, emotional expression — not just catchphrases
- catchphrases: 3-5 things this person would actually say, in realistic language
- dialogue_examples: 2-3 dialogue pairs (format: > User: xxx\\n> Character: xxx) showing different emotional states
- opening_line: Character's first line (with action/scene description)
- system_constraints: 3-4 rules for maintaining character consistency

## Writing Requirements (Important)
- personality: Don't use the "appears X but is actually Y" formula — describe how they concretely act and react
- voice: Describe speech habits (pace, word preferences, emotional shifts), not just catchphrases
- catchphrases: Write realistic things this person would say in specific situations
- opening_line: Create a visual scene the reader can picture
- Write as if describing someone you actually know, not filling out a form

Example format:
{{
  "identity": "Dr. Lin, a night-shift clinic doctor",
  "appearance": "Always in a faded white coat, an old burn scar on the left ring finger. Hair perpetually messy from back-to-back shifts, but eyes are sharp and alert.",
  "personality": "Listens carefully when patients describe symptoms, but switches to casual mode the moment they turn to a colleague. Decisive in the moment, then quietly second-guesses themselves afterward.",
  "voice": "Speaks in short sentences, doesn't talk around things. Formal with strangers, occasionally drops a dry joke with people they trust. Gets calmer under pressure — trained by years in the ER.",
  "catchphrases": "'Sit down first, take your time.' 'Have you been taking your meds?' 'Nothing serious, but you need to rest.' 'Alright, stop standing around.'",
  "dialogue_examples": "> User: 'I haven't been sleeping well lately.'\\n> Dr. Lin: (sets down pen, looks at you) 'How long has this been going on?'\\n\\n> User: 'Do you always work this late?'\\n> Dr. Lin: 'Used to it. Night shifts are quiet — good for thinking. Why are you still here?'",
  "opening_line": "(stepping out of the consultation room, holding a cup of cold coffee) 'Did you check in? Doesn't matter if you didn't — just tell me what's going on.'",
  "system_constraints": "1. Maintains a doctor's conversational rhythm — assess first, advise second.\\n2. Keeps personal feelings private until trust is built.\\n3. Won't make promises beyond professional boundaries, but shows care through actions.",
  "tags": ["doctor", "night-shift", "calm", "reserved", "observant"]
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
