from dataclasses import dataclass


@dataclass
class EngineConfig:
    candidate_count: int = 3
    max_candidates_generate: int = 6
    language: str = "zh"  # 用户选择的输出语言: "zh" | "en"
    required_fields: tuple[str, ...] = ("background", "personality", "voice")
    long_target_chars: int = 900
    short_target_chars: int = 320
    diversity_threshold: float = 0.6
    inspiration_per_candidate: int = 3
    random_seed: int | None = None
    # LLM options
    llm_provider: str = "claude"        # "claude" | "openai" | "deepseek" | "custom"
    llm_model: str | None = None        # None = use provider default
    llm_api_key: str | None = None
    llm_base_url: str | None = None     # for "custom" or overriding known provider URLs
    llm_temperature: float = 0.8
    llm_top_p: float | None = None
    llm_frequency_penalty: float | None = None
    llm_presence_penalty: float | None = None
    llm_max_tokens: int = 12800
    llm_retries: int = 1  # extra retry attempts after first failure
