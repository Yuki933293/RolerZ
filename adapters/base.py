"""Abstract base adapter — the only interface a platform needs to implement."""
from __future__ import annotations

from abc import ABC, abstractmethod


class BaseAdapter(ABC):
    """
    Minimal contract between the persona engine and any host platform.

    Implementors receive one user message at a time and return one reply string.
    Session lifecycle (start / answer / finish) is managed internally by the adapter.

    Subclassing example::

        class MyPlatformAdapter(BaseAdapter):
            def on_message(self, user_id: str, text: str) -> str:
                ...  # call wizard, return reply text

            def reset(self, user_id: str) -> str:
                ...  # clear session for user_id, return confirmation text
    """

    @abstractmethod
    def on_message(self, user_id: str, text: str) -> str:
        """
        Process one inbound message and return the reply to send back.

        Parameters
        ----------
        user_id:
            Opaque identifier for the user/conversation (string). Used to
            route messages to the correct in-progress WizardSession.
        text:
            The raw message text from the user.

        Returns
        -------
        str
            The reply text to display or send to the user.
        """

    @abstractmethod
    def reset(self, user_id: str) -> str:
        """
        Discard the active session for `user_id` and return a reset confirmation.

        Useful for handling "/reset" or "restart" commands on the platform side.
        """
