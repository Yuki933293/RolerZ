# RolerZ — 角色锻造台

基于 LLM 的角色人格卡创作平台，通过 AI 生成中/英双语角色人格卡片。

React + FastAPI 全栈架构，支持 Claude / OpenAI / DeepSeek / 自定义 Provider。

## 目录结构

```
backend/main.py          — FastAPI 入口（认证、API 路由）
persona_engine/          — 核心引擎（生成、评分、灵感库、模板）
database.py              — SQLite 用户认证与数据持久化
data/                    — 灵感卡(49张) + 模板库(8个)
frontend/                — React + TypeScript + Vite + Tailwind CSS
deploy.sh                — 服务器一键部署脚本
update.sh                — 服务器更新脚本
start.sh                 — 本地开发启动脚本
```

## 本地开发 & 部署

详见 [DEPLOY.md](DEPLOY.md)

## LLM Provider 配置

| Provider | 需要 | 环境变量 |
|----------|------|----------|
| Claude | `anthropic` 包 | `ANTHROPIC_API_KEY` |
| OpenAI | `openai` 包 | `OPENAI_API_KEY` |
| DeepSeek | `openai` 包 | `DEEPSEEK_API_KEY` |
| 自定义 | OpenAI 兼容接口 | 自定义 base_url |

在网站「模型供应商」页面中配置即可，无需修改代码。

## License

MIT
