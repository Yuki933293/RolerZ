"""
Platform adapters for the Persona Wizard Core Engine.

Each adapter wraps WizardEngine behind a simple one-method interface so that
third-party platforms (chat bots, web APIs, CLI tools, etc.) can be integrated
without knowing about the engine internals.

Available adapters
------------------
- ChatbotAdapter  — message-at-a-time chat interface (manages sessions by user_id)

Usage (any platform)::

    from adapters import ChatbotAdapter

    adapter = ChatbotAdapter()

    # Route incoming messages from your platform:
    reply = adapter.on_message(user_id="u_123", text="沉默的城市治愈者")
    # → "请描述角色的背景故事：..."

    reply = adapter.on_message(user_id="u_123", text="曾是战地医护，退役后隐居城中")
    # → next question or final persona card
"""
from .base import BaseAdapter
from .chatbot import ChatbotAdapter

__all__ = ["BaseAdapter", "ChatbotAdapter"]
