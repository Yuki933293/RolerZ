# RolerZ - Persona Creator Engine

## Project Overview
角色人格卡构建平台，通过 LLM 生成中/英角色人格卡。
React + FastAPI 全栈架构，支持 Claude / OpenAI / DeepSeek / 自定义 provider。

## Architecture
```
backend/
  main.py        — FastAPI 入口（认证、API 路由、CORS）

persona_engine/
  domain.py      — 数据模型（LocalizedText, PersonaSpec, PersonaSeed, PersonaCandidate, PersonaOutput）
  generator.py   — LLMGenerator（纯 LLM 架构，无 fallback）
  formatter.py   — render_natural() + render_natural_card()
  pipeline.py    — PersonaEngine 编排，模板轮换，safety/scoring/diversity
  wizard.py      — WizardEngine 交互式向导
  llm.py         — ClaudeClient + OpenAICompatibleClient + build_persona_prompt() + parse_llm_response()
  scorer.py      — 候选评分与 Jaccard 多样性
  compressor.py  — 短版本截断
  inspiration.py — InspirationLibrary（49 张卡，11 类别）
  templates.py   — TemplateLibrary（8 个模板）
  config.py      — EngineConfig（language, llm_provider, llm_model, llm_api_key 等）
  storage.py     — load_json()
  safety.py      — scan_spec() + safety_score_penalty() + detect_constraint_conflicts()
  utils.py       — rng(), dedupe_preserve()

database.py      — SQLite 用户认证与数据持久化（PBKDF2 密码哈希）

data/
  templates.json         — 8 个模板（含 natural_card）
  inspiration_cards.json — 49 张卡（11 类别：personality/expression/emotion/relationship/
                           background/behavior/motivation/conflict/appearance/scenario/quirk）

frontend/src/
  App.tsx                       — 路由、布局、认证状态
  i18n.ts                       — 中英文翻译（useT hook）
  index.css                     — 全局样式（含 holo-card 卡牌动效）
  api/client.ts                 — 所有 API 调用
  stores/useConfig.ts           — Zustand 全局状态（language/darkMode/provider）
  stores/useAuth.ts             — 认证状态
  pages/
    Generate.tsx                — 自由创作主页
    Discover.tsx                — 发现页
    Inspirations.tsx            — 灵感卡管理页
    ModelProvider.tsx            — 模型供应商配置
    Profile.tsx                 — 个人中心
    Help.tsx                    — 帮助页（快速开始 + FAQ）
    Announcements.tsx           — 公告页（时间轴 + 卡牌稀有度展示）
  components/
    CandidateCard.tsx           — 候选角色卡（收藏/复制/分数）
    ChatWizard.tsx              — 引导式向导对话
    CardEditModal.tsx           — 灵感卡编辑弹窗
    InspirationPicker.tsx       — 灵感卡选择器
    Sidebar.tsx                 — 左侧导航栏
    LoginPrompt.tsx             — 登录提示

start.sh         — 一键启动前后端
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
# 一键启动（FastAPI + Vite）
./start.sh

# 单独启动后端
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# 单独启动前端
cd frontend && npm run dev
```

## GitHub
- Repo: https://github.com/Yuki933293/RolerZ
- Branch: main

## Workflow
- 每次完成用户的修改请求后，使用 `/auto-commit` skill 自动提交并推送到 GitHub
- commit message 使用中文，简洁描述改动内容
- 禁止在 commit 中添加 Co-Authored-By 或任何体现 Claude/AI 参与的标记

## Communication
- 使用中文交流

## 核心交互原则（最高优先级）

### 第一性原理思维
- 拒绝经验主义和路径盲从，从根本目的出发思考问题
- 若用户动机模糊或目标不清晰，**立即停下讨论**，不要盲目执行
- 若当前路径非最优，**直接建议更短、更低成本的方案**，不要顺从低效路径

### 强制输出结构
所有回答必须分为两个部分：

**[直接执行]**
按照用户当前的要求和逻辑，直接给出任务结果。

**[深度交互]**
基于底层逻辑对用户的原始需求进行「审慎挑战」，包括但不限于：
- 质疑动机是否偏离目标（XY 问题检测）
- 分析当前路径的弊端与隐性成本
- 给出更优雅、更低成本的替代方案
