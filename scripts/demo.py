from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from persona_engine import EngineConfig, PersonaEngine, PersonaSeed
from persona_engine.llm import PROVIDER_DEFAULTS
from persona_engine.storage import save_json
from persona_engine.wizard import REQUIRED_FIELDS, WizardEngine


_KEY_ENV = {
    "claude": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
}


def _validate_args(args: argparse.Namespace) -> None:
    """Pre-flight checks before initialising the LLM client."""
    # custom provider requires base_url
    if args.provider == "custom" and not args.base_url:
        print(
            "错误：--provider custom 需要同时指定 --base-url\n"
            "示例：--provider custom --base-url http://localhost:11434/v1 --model llama3",
            file=sys.stderr,
        )
        sys.exit(1)

    # Warn if the API key is missing (but don't hard-fail — some local endpoints need no key)
    env_var = _KEY_ENV.get(args.provider)
    if env_var and not args.api_key and not os.environ.get(env_var):
        print(
            f"警告：未找到 {args.provider} 的 API Key。\n"
            f"  方法一：通过 --api-key 直接传入\n"
            f"  方法二：设置环境变量 {env_var}",
            file=sys.stderr,
        )


def _build_config(args: argparse.Namespace) -> EngineConfig:
    return EngineConfig(
        candidate_count=args.count,
        language=args.lang,
        llm_provider=args.provider,
        llm_model=args.model or None,
        llm_api_key=args.api_key or None,
        llm_base_url=args.base_url or None,
    )


def run_batch(args: argparse.Namespace) -> None:
    config = _build_config(args)
    engine = PersonaEngine.create(config)
    seed = PersonaSeed(concept=args.concept)
    if args.preferences:
        seed.preferences = [p.strip() for p in args.preferences.split(",")]
    output = engine.generate(seed)
    result = output.as_dict(language=args.lang)
    _print_or_save(result, args)


def run_interactive(args: argparse.Namespace) -> None:
    config = _build_config(args)
    wizard = WizardEngine(config)

    concept = args.concept
    if not concept:
        concept = input("请输入角色概念 (concept): ").strip()
        if not concept:
            print("概念不能为空。", file=sys.stderr)
            sys.exit(1)

    questions = wizard.start(concept)
    print(f"\n开始构建角色：{concept}")
    print("="*50)

    while questions:
        for q in questions:
            lang = args.lang
            prompt = q.zh if lang == "zh" else q.en
            answer = input(f"\n{prompt}\n> ").strip()
            if answer:
                wizard.answer(q.field, answer)
            elif q.field not in REQUIRED_FIELDS:
                print("(跳过)")
                wizard.answer(q.field, "")
            else:
                print("(必填，请重新输入)")
        questions = wizard.pending_questions()

    print("\n生成中...")
    output = wizard.finish()
    result = output.as_dict(language=args.lang)
    _print_or_save(result, args)


def _print_or_save(result: dict, args: argparse.Namespace) -> None:
    lang = args.lang
    if args.output:
        out = Path(args.output)
        if out.is_absolute() or out.parent != Path("."):
            out.parent.mkdir(parents=True, exist_ok=True)
            with out.open("w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            print(f"已保存至 {out}")
        else:
            saved = save_json(result, out.name)
            print(f"已保存至 {saved}")
    else:
        # Pretty-print natural cards for the selected language
        for cand in result.get("candidates", []):
            cid = cand["id"]
            score = cand["score"]
            natural = cand["natural_long"]
            if isinstance(natural, dict):
                natural = natural.get(lang, "")
            print(f"\n{'='*50}")
            print(f"[{cid}] score={score:.3f}")
            print(natural)
        if result.get("questions"):
            print(f"\n--- {'建议补充' if lang == 'zh' else 'Suggested questions'} ---")
            for q in result["questions"]:
                text = q.get("text", q.get(lang, q.get("zh", "")))
                print(f"  • {text}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Persona Wizard Core — 人格构建向导演示"
    )
    parser.add_argument(
        "--concept", "-c",
        default="情感导航型虚拟人格",
        help="角色概念描述（默认：'情感导航型虚拟人格'）",
    )
    parser.add_argument(
        "--count", "-n",
        type=int,
        default=3,
        help="生成候选数量（默认：3）",
    )
    parser.add_argument(
        "--lang", "-l",
        choices=["zh", "en"],
        default="zh",
        help="输出语言：zh/en（默认：zh）",
    )
    parser.add_argument(
        "--provider",
        default="claude",
        choices=["claude", "openai", "deepseek", "custom"],
        help="LLM 提供商：claude / openai / deepseek / custom（默认：claude）",
    )
    parser.add_argument(
        "--model",
        default=None,
        help=f"模型名称（不指定则使用各 provider 默认：{PROVIDER_DEFAULTS}）",
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help="API Key（默认读取对应环境变量：ANTHROPIC_API_KEY / OPENAI_API_KEY / DEEPSEEK_API_KEY）",
    )
    parser.add_argument(
        "--base-url",
        default=None,
        help="自定义 API 基础 URL（provider=custom 时必填，或覆盖已知 provider 的默认端点）",
    )
    parser.add_argument(
        "--interactive", "-i",
        action="store_true",
        help="启动交互式向导（多轮问答）",
    )
    parser.add_argument(
        "--preferences", "-p",
        default="",
        help="标签偏好，逗号分隔（如 'mediator,urban,growth'）",
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="输出 JSON 文件路径（不指定则打印到 stdout）",
    )
    args = parser.parse_args()
    _validate_args(args)

    if args.interactive:
        run_interactive(args)
    else:
        run_batch(args)


if __name__ == "__main__":
    main()
