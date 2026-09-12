"""Conversation persistence.

One JSON file per conversation, holding a flat list of messages. A conversation
title is stored as a ``system`` message carrying a ``title`` field, so that
renaming never touches the file name.
"""

import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from formulas import normalize_math_formulas
from workspace import Workspace

logger = logging.getLogger(__name__)

DEFAULT_TITLE = "New conversation"
TITLE_PREVIEW_LENGTH = 30


def _chat_file(workspace: Workspace, chat_id: str) -> Path:
    return workspace.chat_history / f"{chat_id}.json"


def _read(path: Path) -> List[Dict]:
    if not path.exists():
        return []
    try:
        messages = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        logger.error("Corrupted conversation file: %s", path)
        return []
    return messages if isinstance(messages, list) else []


def _write(path: Path, messages: List[Dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(messages, ensure_ascii=False, indent=2), encoding="utf-8")


def _title_of(messages: List[Dict]) -> str:
    for message in messages:
        if message.get("role") == "system" and "title" in message:
            return message["title"]
    for message in messages:
        if message.get("role") == "user" and message.get("content"):
            content = message["content"]
            suffix = "..." if len(content) > TITLE_PREVIEW_LENGTH else ""
            return content[:TITLE_PREVIEW_LENGTH] + suffix
    return DEFAULT_TITLE


def load(workspace: Workspace, chat_id: str) -> List[Dict]:
    """Return the messages of a conversation, filling in any missing fields."""
    messages = _read(_chat_file(workspace, chat_id))
    for message in messages:
        message.setdefault("role", "system")
        message.setdefault("content", "")
        message.setdefault("timestamp", datetime.now().isoformat())
        message.setdefault("message_id", str(uuid.uuid4()))
    return messages


def append(
    workspace: Workspace,
    chat_id: str,
    role: str,
    content: str,
    additional_data: Optional[Dict] = None,
) -> Optional[Dict]:
    """Append one message and return it."""
    if not chat_id:
        return None

    if role == "assistant":
        content = normalize_math_formulas(content)

    message = {
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat(),
        "message_id": str(uuid.uuid4()),
    }
    if additional_data:
        message["additional_data"] = additional_data

    path = _chat_file(workspace, chat_id)
    messages = _read(path)
    messages.append(message)
    _write(path, messages)
    return message


def context(workspace: Workspace, chat_id: str, max_turns: int = 10) -> List[str]:
    """Return the last turns of a conversation as plain ``Role: text`` lines."""
    if not chat_id:
        return []
    labels = {"user": "User", "assistant": "Assistant"}
    return [
        f"{labels[message['role']]}: {message['content']}"
        for message in load(workspace, chat_id)[-max_turns:]
        if message.get("role") in labels
    ]


def summaries(workspace: Workspace) -> List[Dict]:
    """Return one entry per conversation, most recently updated first."""
    if not workspace.chat_history.exists():
        return []

    entries = []
    for path in workspace.chat_history.glob("*.json"):
        messages = _read(path)
        updated_at = next(
            (m["timestamp"] for m in reversed(messages) if isinstance(m, dict) and "timestamp" in m),
            datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
        )
        entries.append({
            "id": path.stem,
            "title": _title_of(messages),
            "message_count": len(messages),
            "updated_at": updated_at,
        })

    entries.sort(key=lambda entry: entry["updated_at"], reverse=True)
    return entries


def rename(workspace: Workspace, chat_id: str, title: str) -> bool:
    path = _chat_file(workspace, chat_id)
    if not path.exists():
        return False

    messages = _read(path)
    for message in messages:
        if message.get("role") == "system" and "title" in message:
            message["title"] = title
            break
    else:
        messages.insert(0, {
            "role": "system",
            "content": "Conversation title",
            "title": title,
            "timestamp": datetime.now().isoformat(),
            "message_id": str(uuid.uuid4()),
        })

    _write(path, messages)
    return True


def delete(workspace: Workspace, chat_id: str) -> bool:
    path = _chat_file(workspace, chat_id)
    if not path.exists():
        return False
    path.unlink()
    return True


def edit(workspace: Workspace, chat_id: str, index: int, content: str) -> List[Dict]:
    """Rewrite a user message and drop everything that followed it.

    Raises:
        IndexError: The index does not address an existing message.
        ValueError: The addressed message was not written by the user.
    """
    messages = load(workspace, chat_id)
    if not 0 <= index < len(messages):
        raise IndexError(index)

    target = messages[index]
    if target["role"] != "user":
        raise ValueError("Only user messages can be edited")

    edited = {
        "role": "user",
        "content": content,
        "timestamp": datetime.now().isoformat(),
        "message_id": str(uuid.uuid4()),
        "edited_at": datetime.now().isoformat(),
    }
    if "additional_data" in target:
        edited["additional_data"] = target["additional_data"]

    messages = messages[:index] + [edited]
    _write(_chat_file(workspace, chat_id), messages)
    return messages
