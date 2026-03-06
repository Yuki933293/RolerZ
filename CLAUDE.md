# RolerZ - Persona Creator Engine

## Project Overview
平台无关的"人格构建向导"核心引擎，通过 LLM 生成双语（中/英）角色人格卡。
Streamlit Web UI + Python 引擎，支持 Claude / OpenAI / DeepSeek / 自定义 provider。

## Architecture (v0.3.0)
```
persona_engine/
  domain.py      — 数据模型（LocalizedText, PersonaSpec, PersonaSeed, Question, PersonaCandidate, PersonaOutput）
  generator.py   — LLMGenerator（纯 LLM 架构，无 fallback）
  formatter.py   — render_natural() + render_natural_card()
  pipeline.py    — PersonaEngine 编排，模板轮换，safety/scoring/diversity
  wizard.py      — WizardEngine 交互式向导
  llm.py         — ClaudeClient + OpenAICompatibleClient + build_persona_prompt() + parse_llm_response()
  scorer.py      — 候选评分与 Jaccard 多样性
  compressor.py  — 短版本截断
  inspiration.py — InspirationLibrary（50 张卡，8 类别）
  templates.py   — TemplateLibrary（8 个模板）
  config.py      — EngineConfig（language, llm_provider, llm_model, llm_api_key 等）
  storage.py     — load_json()
  safety.py      — scan_spec() + safety_score_penalty() + detect_constraint_conflicts()
  utils.py       — rng(), dedupe_preserve()

data/
  templates.json         — 8 个模板（含 natural_card）
  inspiration_cards.json — 50 张卡（8 类别：personality/expression/emotion/relationship/background/behavior/motivation/conflict）

app.py          — Streamlit Web UI（3 tab：快速生成 / 引导向导 / 模型设置）
scripts/demo.py — CLI 入口（argparse）
schemas/        — JSON Schema 验证
```

## Key Design Decisions
- 纯 LLM 架构，LLM 失败直接抛 RuntimeError
- 单语言输出：`EngineConfig.language` 控制 prompt/parse/render/as_dict 全链路
- `as_dict(language="zh")` 输出纯字符串；`as_dict()` 无参数保留 `{"zh":..,"en":..}` 双语格式
- `generator.generate()` 返回 `tuple[PersonaSpec, GenerationContext]`
- 灵感卡选择：用户可通过 `PersonaSeed.selected_inspirations` 指定卡片 ID，优先使用
- `max_tokens=6400`

## LLM Providers
- claude: 需 `anthropic` 包 + `ANTHROPIC_API_KEY`
- openai: 需 `openai` 包 + `OPENAI_API_KEY`
- deepseek: 需 `openai` 包 + `DEEPSEEK_API_KEY`
- custom: OpenAI 兼容接口 + 自定义 base_url

## Run Commands
```bash
# Streamlit UI
streamlit run app.py

# CLI
ANTHROPIC_API_KEY=sk-... python3 scripts/demo.py --concept "沉默的城市治愈者" --count 3
ANTHROPIC_API_KEY=sk-... python3 scripts/demo.py --concept "rebel archivist" --lang en
DEEPSEEK_API_KEY=sk-... python3 scripts/demo.py --provider deepseek --concept "叛逆档案师"
ANTHROPIC_API_KEY=sk-... python3 scripts/demo.py --interactive
```

## GitHub
- Repo: https://github.com/Yuki933293/RolerZ
- Branch: main

## Communication
- 使用中文交流
