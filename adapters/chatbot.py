"""
ChatbotAdapter — message-at-a-time adapter for chat platforms.

Manages one WizardSession per user_id. Each incoming message advances the
wizard by one question-answer step. When all required questions are answered
the best persona candidate is rendered and returned as the final reply.

Typical flow
------------
User:    "沉默的城市治愈者"          ← concept (first message)
Bot:     "请描述角色的背景故事：…"
User:    "曾是战地医护，退役后隐居城中"
Bot:     "请描述角色的性格特征：…"
User:    "沉默，但在关键时刻果断"
Bot:     "请描述角色的说话风格：…"
User:    "语速平稳，几乎不高声"
Bot:     (生成角色卡 natural_long)
"""
from __future__ import annotations

from persona_engine.config import EngineConfig
from persona_engine.domain import Question
from persona_engine.wizard import WizardEngine
from .base import BaseAdapter

_RESET_KEYWORDS = frozenset(["重置", "restart", "reset", "/reset", "/重置"])

_MSG_RESET = "会话已重置。请发送角色概念开始新的构建。"
_MSG_GENERATING = "正在生成角色，请稍候…"
_MSG_NO_RESULT = "（生成失败，请重试）"
_MSG_WELCOME = '欢迎！请发送你想构建的角色概念（例如："沉默的城市治愈者"）。'


class ChatbotAdapter(BaseAdapter):
    """
    Stateful one-message-at-a-time adapter.

    One instance can serve many concurrent users. Sessions are kept in memory;
    for persistence across process restarts use ``save_session`` / ``load_session``.

    Parameters
    ----------
    config:
        Optional EngineConfig. Shared across all user sessions created by this adapter.
    lang:
        Display language for questions and persona output. ``"zh"`` or ``"en"``.
    """

    def __init__(self, config: EngineConfig | None = None, lang: str = "zh") -> None:
        self._config = config or EngineConfig()
        self._lang = lang
        # user_id → active WizardEngine
        self._engines: dict[str, WizardEngine] = {}
        # user_id → pending question list (the batch returned by the last wizard call)
        self._pending: dict[str, list[Question]] = {}

    # ------------------------------------------------------------------
    # BaseAdapter interface
    # ------------------------------------------------------------------

    def on_message(self, user_id: str, text: str) -> str:
        """Route one user message and return the reply."""
        text = text.strip()

        if text.lower() in _RESET_KEYWORDS:
            return self.reset(user_id)

        if user_id not in self._engines:
            return self._start_session(user_id, concept=text)

        return self._advance_session(user_id, answer_text=text)

    def reset(self, user_id: str) -> str:
        """Discard the active session for this user."""
        self._engines.pop(user_id, None)
        self._pending.pop(user_id, None)
        return _MSG_RESET

    # ------------------------------------------------------------------
    # Session persistence helpers (optional — requires storage module)
    # ------------------------------------------------------------------

    def save_session(self, user_id: str, name: str) -> None:
        """Persist the current session to output/<name> via storage.save_json.

        Raises RuntimeError if no session exists for user_id.
        Requires the storage module; no-op if not available.
        """
        engine = self._engines.get(user_id)
        if engine is None:
            raise RuntimeError(f"No active session for user_id={user_id!r}")
        try:
            from persona_engine.storage import save_json
            save_json(engine.to_dict(), name)
        except ImportError:
            pass

    def load_session(self, user_id: str, data: dict, llm_api_key: str | None = None) -> str:
        """Restore a previously saved session from a dict (e.g. loaded via load_json).

        Returns the next pending question so the user can continue where they left off.
        """
        engine = WizardEngine.from_dict(data, llm_api_key=llm_api_key)
        self._engines[user_id] = engine
        questions = engine.pending_questions()
        self._pending[user_id] = questions
        if questions:
            return self._format_question(questions[0])
        return self._generate_and_close(user_id)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _start_session(self, user_id: str, concept: str) -> str:
        """Create a new WizardEngine for concept and return the first question."""
        engine = WizardEngine(self._config)
        questions = engine.start(concept)
        self._engines[user_id] = engine
        self._pending[user_id] = questions
        if questions:
            return self._format_question(questions[0])
        # No questions needed — generate immediately
        return self._generate_and_close(user_id)

    def _advance_session(self, user_id: str, answer_text: str) -> str:
        """Feed one answer to the wizard and return the next question or final result."""
        engine = self._engines[user_id]
        pending = self._pending.get(user_id, [])

        if not pending:
            return self._generate_and_close(user_id)

        # Answer the first question in the pending batch
        current_q = pending[0]
        next_questions = engine.answer(current_q.field, answer_text)

        if not next_questions:
            return self._generate_and_close(user_id)

        self._pending[user_id] = next_questions
        return self._format_question(next_questions[0])

    def _generate_and_close(self, user_id: str) -> str:
        """Trigger generation, clean up session, return rendered persona card."""
        engine = self._engines.pop(user_id, None)
        self._pending.pop(user_id, None)

        if engine is None:
            return _MSG_NO_RESULT

        output = engine.finish()
        if not output.candidates:
            return _MSG_NO_RESULT

        best = output.candidates[0]
        card = best.natural_long.get(self._lang) or best.natural_short.get(self._lang, "")
        return card or _MSG_NO_RESULT

    def _format_question(self, q: Question) -> str:
        return q.zh if self._lang == "zh" else q.en
