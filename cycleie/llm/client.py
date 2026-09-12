"""Unified client for OpenAI-compatible chat completion endpoints."""

import logging
import os
import time
from typing import Dict, List, Optional

import requests
from dotenv import load_dotenv

from ..config import DEFAULT_MODEL

load_dotenv()

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 5
REQUEST_TIMEOUT_SECONDS = 300

_model = DEFAULT_MODEL


def set_model(model: str) -> None:
    """Set the backbone model used by every agent."""
    global _model
    _model = model


def get_model() -> str:
    """Return the backbone model currently in use."""
    return _model


def _endpoint(model: str) -> Dict[str, str]:
    """Resolve the API credentials for a model family."""
    if model.lower().startswith("qwen"):
        base_url = os.getenv("QWEN_BASE_URL")
        api_key = os.getenv("QWEN_API_KEY")
    else:
        base_url = os.getenv("OPENAI_BASE_URL")
        api_key = os.getenv("OPENAI_API_KEY")

    if not base_url or not api_key:
        raise RuntimeError(
            f"Missing API credentials for model '{model}'. "
            "Copy .env.example to .env and fill in the endpoint and key."
        )
    return {"base_url": base_url.rstrip("/"), "api_key": api_key}


def _build_messages(prompt: str, system_prompt: Optional[str], history: Optional[List[Dict]]) -> List[Dict]:
    messages: List[Dict] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": prompt})
    return messages


def get_llm_response(
    prompt: str,
    model: Optional[str] = None,
    system_prompt: Optional[str] = None,
    history: Optional[List[Dict]] = None,
    temperature: float = 0.0,
) -> str:
    """Send a chat completion request and return the generated text.

    Returns an empty string when the endpoint keeps failing, so that a single
    unreachable call degrades one agent step instead of aborting the workflow.
    """
    model = model or get_model()
    endpoint = _endpoint(model)

    payload = {
        "model": model,
        "messages": _build_messages(prompt, system_prompt, history),
        "temperature": temperature,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {endpoint['api_key']}",
    }

    for attempt in range(MAX_RETRIES):
        try:
            response = requests.post(
                f"{endpoint['base_url']}/chat/completions",
                headers=headers,
                json=payload,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except (requests.RequestException, KeyError, ValueError) as error:
            logger.warning("LLM call to %s failed (attempt %d): %s", model, attempt + 1, error)
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY_SECONDS)

    logger.error("LLM call to %s failed after %d attempts", model, MAX_RETRIES)
    return ""


def stream_llm_response(
    prompt: str,
    model: Optional[str] = None,
    system_prompt: Optional[str] = None,
    history: Optional[List[Dict]] = None,
    temperature: float = 0.0,
    stop_event=None,
):
    """Yield generated text incrementally.

    ``stop_event`` is an optional ``threading.Event``; when it is set the
    generator returns so that a disconnected client stops consuming tokens.
    """
    model = model or get_model()
    endpoint = _endpoint(model)

    payload = {
        "model": model,
        "messages": _build_messages(prompt, system_prompt, history),
        "temperature": temperature,
        "stream": True,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {endpoint['api_key']}",
    }

    try:
        response = requests.post(
            f"{endpoint['base_url']}/chat/completions",
            headers=headers,
            json=payload,
            stream=True,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException as error:
        logger.error("Streaming LLM call to %s failed: %s", model, error)
        return

    import json

    for line in response.iter_lines():
        if stop_event is not None and stop_event.is_set():
            return
        if not line:
            continue
        decoded = line.decode("utf-8")
        if not decoded.startswith("data: "):
            continue
        chunk = decoded[len("data: "):]
        if chunk == "[DONE]":
            return
        try:
            delta = json.loads(chunk)["choices"][0].get("delta", {})
        except (json.JSONDecodeError, KeyError, IndexError):
            continue
        if "content" in delta:
            yield delta["content"]
