# Persona Wizard Core (B2)

平台无关的“虚拟人格构建向导”核心引擎：提供中英双语、强制字段（背景/性格/语气）、多候选输出与双版本（长/短）结构化 + 自然语言输出。后续可通过适配层对接 AstrBot 或其他插件平台。

## 设计目标
- 解决“没有思路”的用户痛点：灵感库 + 模板库 + 引导式缺失字段提问。
- 默认 3 个候选输出，自动去重与多样性控制。
- 同时输出自然语言角色卡与结构化 JSON（长/短两个版本）。

## 目录结构
- `persona_engine/`: 核心引擎代码
- `data/`: 灵感卡与模板库
- `schemas/`: 输出结构 JSON Schema
- `scripts/demo.py`: 本地演示脚本

## 快速运行
```bash
python3 scripts/demo.py
```

## 关键概念
- `PersonaSeed`: 用户输入/偏好/约束
- `PersonaSpec`: 双语结构化角色信息
- `PersonaCandidate`: 单个候选（长/短 + 自然语言）
- `PersonaOutput`: 全部候选 + 待补充问题 + 元信息

## 后续扩展
- 接入真实 LLM：实现 `LLMClient` 并在 `RuleBasedGenerator` 中替换为 LLM 生成。
- 插件适配：添加 `adapters/astrbot.py` 映射 PersonaSpec 到平台 Persona 数据结构。
- 灵感库扩展：增加更多 archetype / relationship / conflict / growth 卡片。

## 输出结构
参考 `schemas/persona_spec.schema.json`。
