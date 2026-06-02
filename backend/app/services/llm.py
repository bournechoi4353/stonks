"""Claude adapter (Phase 3).

A thin, single-shot LLM interface built on the Claude Agent SDK. It authenticates via
the user's Claude Code subscription (the installed `claude` CLI) — no Anthropic API key.

The call is locked down to pure reasoning: all tools disabled, one turn, and the user's
own Claude settings / MCP servers / project files are NOT loaded (setting_sources=[]),
so the model only sees the prompt we send.
"""
from __future__ import annotations

import json
import re
from typing import Optional

from app.config import settings


class AIError(Exception):
    """Generic AI reasoning failure (bad/empty output, parse error)."""


class AIUnavailableError(AIError):
    """The Claude Agent SDK or `claude` CLI is unavailable / not authenticated."""


async def acomplete(prompt: str, system: Optional[str] = None, model: Optional[str] = None) -> str:
    """Run one reasoning turn and return the assistant's text."""
    try:
        from claude_agent_sdk import (
            AssistantMessage,
            ClaudeAgentOptions,
            ResultMessage,
            TextBlock,
            query,
        )
        from claude_agent_sdk import CLINotFoundError, ClaudeSDKError
    except ImportError as exc:  # pragma: no cover
        raise AIUnavailableError("claude-agent-sdk is not installed") from exc

    options = ClaudeAgentOptions(
        system_prompt=system,
        model=model or settings.ai_model,
        allowed_tools=[],  # no tools — pure reasoning
        disallowed_tools=["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch", "WebFetch", "Task", "NotebookEdit"],
        permission_mode="bypassPermissions",  # never block on a prompt (no tools anyway)
        max_turns=1,
        setting_sources=[],  # isolate: don't load the user's CLAUDE.md / settings / MCP
    )

    text = ""
    is_error = False
    try:
        async for message in query(prompt=prompt, options=options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        text += block.text
            elif isinstance(message, ResultMessage):
                is_error = bool(getattr(message, "is_error", False))
    except CLINotFoundError as exc:
        raise AIUnavailableError(
            "Claude CLI not found — cannot use subscription auth. Install/login to Claude Code."
        ) from exc
    except ClaudeSDKError as exc:
        raise AIError(f"Claude SDK error: {exc}") from exc

    text = text.strip()
    if is_error or not text:
        raise AIError("Empty or errored response from the model")
    return text


def extract_json(text: str) -> dict:
    """Pull the first JSON object out of a model response (tolerates code fences/prose)."""
    match = re.search(r"\{.*\}", text.strip(), re.DOTALL)
    if not match:
        raise AIError(f"No JSON object found in model output: {text[:200]}")
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise AIError(f"Model returned invalid JSON: {exc}") from exc
